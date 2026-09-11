import { FaFilePdf, FaFilePowerpoint, FaImage } from "react-icons/fa";
import { FiUpload } from "react-icons/fi";

export const SlideDropArea = ({
  title,
  isDragActive,
  headingLevel: Heading = "h1",
}: {
  title: string;
  isDragActive?: boolean;
  headingLevel?: "h1" | "h2";
}) => (
  <div
    className={`cursor-pointer bg-slate-50 rounded-xl border-2 border-dashed overflow-hidden group transition-colors flex flex-col items-center justify-center text-center p-6 md:p-10 min-h-[250px] md:min-h-[400px] ${
      isDragActive
        ? "border-link bg-link/5"
        : "border-slate-300 hover:border-link/50 hover:bg-link/5"
    }`}
  >
    <FiUpload className="w-12 h-12 md:w-16 md:h-16 text-tertiary group-hover:text-link transition-colors mb-4 md:mb-6 pointer-events-none" />

    <Heading className="text-3xl md:text-5xl font-extrabold text-primary tracking-tight group-hover:text-link transition-colors mb-2 md:mb-4 pointer-events-none">
      {title}
    </Heading>

    <p className="text-base md:text-xl text-secondary max-w-2xl leading-relaxed mb-6 md:mb-10 pointer-events-none">
      Drag & drop files here, or{" "}
      <span className="text-link font-semibold">click anywhere</span> to upload
      your presentations.
    </p>

    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 text-xs md:text-sm font-medium text-secondary pointer-events-none">
      <div className="flex items-center gap-2 bg-surface-primary px-3 md:px-4 py-2 rounded-md border border-stroke shadow-sm">
        <FaImage className="text-lg md:text-xl text-gray-700" /> Images
      </div>
      <div className="flex items-center gap-2 bg-surface-primary px-3 md:px-4 py-2 rounded-md border border-stroke shadow-sm">
        <FaFilePowerpoint className="text-lg md:text-xl text-[#cb4a32]" /> PPTX
      </div>
      <div className="flex items-center gap-2 bg-surface-primary px-3 md:px-4 py-2 rounded-md border border-stroke shadow-sm">
        <FaFilePdf className="text-lg md:text-xl text-[#F52102]" /> PDF
      </div>
    </div>
  </div>
);
