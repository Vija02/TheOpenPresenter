import { ImportFilePicker } from "./ImportFile/ImportFilePicker";

const Landing = () => {
  return (
    <div className="center mt-10 p-2">
      <div className="stack-col w-full">
        <h3 className="font-bold text-2xl text-center mb-4">
          Welcome to Slides Presenter
        </h3>

        <ImportFilePicker />
      </div>
    </div>
  );
};
export default Landing;
