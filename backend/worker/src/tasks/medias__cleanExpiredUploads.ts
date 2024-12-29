import { Task } from "graphile-worker";

const task: Task = async (_, { withPgClient }) => {
  // We load this way because of the bundler problem
  // If we compile directly, it moves most of the code into separate files and require them
  // The problem is that the export is within the file that is 'require'd
  // Graphile worker doesn't like this. So, this is a workaround to get things working
  const { deleteExpiredMedia } = await import("../storageMedia");

  await deleteExpiredMedia(withPgClient);
};

module.exports = task;
