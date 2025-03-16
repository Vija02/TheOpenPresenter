# Tauri

This folder is responsible for building TheOpenPresenter's desktop app.
We use Tauri to wrap our server and some frontend into a nice bundle that can be installed on the desktop.

Essentially, the desktop app is:
- Script to initialize PostgreSQL
- A bundle of our node.js server, configured to run locally (we include the `node` binary)
- Tauri to wrap the website into an app window

## What is in the bundle?

- Tauri/Rust code to wrap everything
- PostgreSQL binary
  - Lib for PG extension
- Node.js binary
- Our server code
  - Everything in `backend/server`, `backend/db` (graphile-migrate), and `backend/worker` (graphile-worker)
  - Its dependencies
- Frontend build
  - Remote, Renderer + Next.js
  - Served by the server

## What actually happens when I run the app?

1. Run PostgreSQL
   -  Initialize if needed (Init DB, Create roles, Init schema)
2. Run DB migration (in case we upgraded)
3. Start Node server

TODO: Have a separate frontend to show something while everything is being initialized

## Extra app data

Extra files are stored in appData.
- Linux: `/home/<Username>/.local/share/TheOpenPresenter`
- Windows: `c:\Users\<Username>\AppData\Roaming\TheOpenPresenter`
- macOS: `/Users/<Username>/Library/Application Support/TheOpenPresenter`

Here, we store the `uploads` and `db` folders which is responsible for storing the uploaded files and the database files respectively.

We can also create a `.env` file here that will override the default environment variables.

## Logs

We use [Tauri's logging plugin](https://tauri.app/plugin/logging/) to handle logs.  
The file is stored in:
- Linux: `/home/<Username>/.local/share/com.theopenpresenter.app/logs`
- Windows: `C:\Users\<Username>\AppData\Local\com.theopenpresenter.app\logs`
- macOS: `/Users/<Username>/Library/Logs/com.theopenpresenter.app`

## Bundling notes

### Server code

For the server build, we follow similar steps with the production docker build.  
We use [vercel/nft](https://github.com/vercel/nft) to extract only the dependencies we require to reduce file size.  

TODO: We currently still include the sourcecode in the bundle.

### PostgreSQL

To run postgres, we use the `embedded-postgres` npm package.  
This package is responsible for getting the postgres binary so we don't have to do anything more.

> Note: We have an extra step during installation to copy our PG extension.

### Migration

Since our migration code is in different repos, we've had to do some extra scaffolding here to get everything working.   
There is a separate `.gmrc` file in this repo to setup everything right.

Notes:
- Updated the path to point to the correct migration folder
- Changed how `graphile-worker`'s schema is installed so that we don't have to include `yarn`.

### File directory

In the final bundle, the file structure is flipped.
- tauri
  - node-server
    - theopenpresenter (this repo, without `tauri`)

## Development

TODO: Symlink

## Fragility

As can be seen, there are plenty of things that need to happen for the app to run smoothly. A small change somewhere in the build system could easily break this.

There are also a few places where we've essentially copied the code with some modification.

Anytime we modify the following, we should check that everything still runs:
- Modification to docker production build
- Update to postgres (extension, version, etc)

## Notable limitations

- Port clash
- Worker not running
- Plugins env
