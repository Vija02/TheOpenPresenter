import Remote from "./Remote";
import { CustomTranslationsProvider } from "./translations/customTranslations";
import "./index.css";

const RemoteIndex = () => {
  return (
    <CustomTranslationsProvider>
      <Remote />
    </CustomTranslationsProvider>
  );
};

export default RemoteIndex;
