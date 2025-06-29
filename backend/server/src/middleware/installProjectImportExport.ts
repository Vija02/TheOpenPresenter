import { logger } from "@repo/observability";
import type { Project } from "@repo/portable-file";
import { createTOPFile, parseTOPFile } from "@repo/portable-file";
import { Express } from "express";
import multer from "multer";
import { generateSlug } from "random-word-slugs";
import { Readable } from "stream";

import { withUserPgPool } from "../utils/withUserPgPool";
import { getRootPgPool } from "./installDatabasePools";

export default async function installProjectImportExport(app: Express) {
  // TODO: Handle this better
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
    fileFilter: (req, file, cb) => {
      // Accept .top files
      if (file.originalname.endsWith(".top")) {
        cb(null, true);
      } else {
        cb(new Error("Only .top files are allowed"));
      }
    },
  });

  app.post("/projectImport", upload.single("file"), async (req, res) => {
    try {
      const rootPgPool = getRootPgPool(app);

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const orgId = req.body.orgId;
      if (!orgId) {
        res.status(400).json({ error: "Organization ID is required" });
        return;
      }

      const sessionId = req.user?.session_id;

      if (!sessionId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      // Handle permission. Check if user has access to organization
      const organization = await withUserPgPool(
        app,
        sessionId,
        async (client) => {
          const {
            rows: [row],
          } = await client.query(
            "select * from app_public.organizations where id = $1",
            [orgId],
          );

          return row;
        },
      );

      if (!organization) {
        res.status(400).json({ error: "Organization not found" });
        return;
      }

      // Convert to stream
      const fileStream = new Readable({
        read() {
          this.push(req.file!.buffer);
          this.push(null);
        },
      });

      let parsedData;
      try {
        parsedData = await parseTOPFile(fileStream);
      } catch (error) {
        logger.error({ error }, "/projectImport: failed to parse TOP file");
        res.status(400).json({ error: "Invalid TOP file format" });
        return;
      }

      const { project } = parsedData;

      let categoryId: string | null = null;

      if (project.categoryName) {
        const {
          rows: [category],
        } = await rootPgPool.query(
          `select * from app_public.categories where organization_id = $1 and name = $2`,
          [orgId, project.categoryName],
        );

        // If no category of the same name, create one
        if (!category) {
          const {
            rows: [createdCategory],
          } = await rootPgPool.query(
            `insert into app_public.categories(organization_id, name) values($1, $2) returning *`,
            [orgId, project.categoryName],
          );
          categoryId = createdCategory.id;
        } else {
          categoryId = category.id;
        }
      }

      try {
        // Insert the project
        const { rows } = await rootPgPool.query(
          `select * from app_public.create_full_project($1, $2, $3, $4, $5, $6)`,
          [
            orgId,
            project.name,
            generateSlug(),
            [],
            categoryId,
            project.targetDate,
          ],
        );

        const insertedProject = rows[0];

        // Now insert the document data
        // DEBT: Make this atomic
        await rootPgPool.query(
          `update app_public.projects set document = $1 where id = $2`,
          [project.document, insertedProject.id],
        );

        // TODO: Handle media

        logger.info(
          { projectId: insertedProject.id, projectName: insertedProject.name },
          "/projectImport: successfully imported project",
        );

        res.status(200).json({
          success: true,
          project: insertedProject,
        });
      } catch (error) {
        console.error(error);
        logger.error(
          { error },
          "/projectImport: failed to insert project into database",
        );
        res.status(500).json({ error: "Failed to import project" });
        return;
      }
    } catch (error) {
      console.error(error);
      logger.error({ error }, "/projectImport: unexpected error");
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  });

  app.get("/projectExport", async (req, res) => {
    try {
      // Get project ID from query parameters
      const projectId = req.query.projectId as string;
      if (!projectId) {
        res.status(400).json({ error: "Project ID is required" });
        return;
      }

      const sessionId = req.user?.session_id;

      // If no session id, then not logged in
      if (!sessionId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const projectRow = await withUserPgPool(
        app,
        sessionId,
        async (client) => {
          const { rows } = await client.query(
            "select p.*, c.name as category_name from app_public.projects p left join app_public.categories c on c.id = p.category_id where p.id = $1",
            [projectId],
          );
          return rows[0];
        },
      );

      if (!projectRow) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const projectData: Project = {
        document: Buffer.from(projectRow.document),
        name: projectRow.name,
        targetDate: projectRow.target_date
          ? new Date(projectRow.target_date)
          : undefined,
        categoryName: projectRow.category_name,
      };

      try {
        // Finally, create the file
        const topFileStream = await createTOPFile({
          project: projectData,
          // TODO: Handle media
          mediaRows: [],
          getMedia: () => {
            return new Readable({
              read() {
                this.push(null);
              },
            });
          },
        });

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${projectData.name}.top"`,
        );

        topFileStream.pipe(res);
      } catch (error) {
        console.error("Error creating TOP file:", error);
        logger.error(
          { error, projectId },
          "/projectExport: failed to export TOP file",
        );
        res.status(500).json({ error: "Failed to export file" });
        return;
      }
    } catch (error) {
      console.error("Error creating TOP file:", error);
      logger.error({ error }, "/projectExport: failed to export TOP file");
      res.status(500).json({ error: "Failed to export file" });
      return;
    }
  });
}
