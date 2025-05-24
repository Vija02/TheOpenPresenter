export function ErrorOccurred() {
  return (
    <div className="stack-col items-start">
      <h2 className="text-3xl font-medium">Something Went Wrong</h2>
      <p>
        We're not sure what happened there. Please try again later, or if this
        keeps happening then let us know.
      </p>
      <a href="/">Back to home</a>
    </div>
  );
}
