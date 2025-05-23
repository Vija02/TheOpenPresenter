type PluginScaffoldPropTypes = {
  title: string;
  toolbar?: React.ReactElement;
  postToolbar?: React.ReactElement;
  body?: React.ReactElement;
};

export const PluginScaffold = ({
  title,
  toolbar,
  postToolbar,
  body,
}: PluginScaffoldPropTypes) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 bg-gray-900">
        <div className="stack-row gap-5 flex-wrap">
          <div className="stack-row">
            <p className="font-bold text-white">
              <p>{title}</p>
            </p>
          </div>
          <div className="stack-row justify-between gap-2 flex-1 flex-wrap">
            <div className="stack-row gap-2 flex-wrap">{toolbar}</div>
            <div className="stack-row flex-wrap">{postToolbar}</div>
          </div>
        </div>
      </div>
      <div className="flex w-full h-full">{body}</div>
    </div>
  );
};
