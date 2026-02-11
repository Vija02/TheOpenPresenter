interface FourOhFourProps {
  loggedIn?: boolean;
}

export function FourOhFour({ loggedIn }: FourOhFourProps) {
  return (
    <div data-testid="fourohfour-div" className="text-center center mt-[15vh]">
      <div className="stack-col">
        <p className="text-6xl">404</p>
        <p>
          The page you attempted to load was not found.{" "}
          {loggedIn ? "" : " Maybe you need to log in?"}
        </p>

        <a href="/">Back to Home</a>
      </div>
    </div>
  );
}
