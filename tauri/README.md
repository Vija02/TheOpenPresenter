# Tauri

This folder is responsible for building TheOpenPresenter's desktop app.
We use Tauri to wrap our server and some frontend into a nice bundle that can be installed on the desktop.

Essentially, the desktop app is:
- Script to initialize PostgreSQL
- A bundle of our node.js server, configured to run locally (we include the `node` binary)
- Tauri to wrap the website into an app window

> Note: This currently only builds a windows version of the app. To get it working with Linux and MacOS, there are a few things that need to be done. See the section at the end of this README for more info.

## Getting started

1. Make sure the main project is built
2. Install the dependencies - `yarn`
3. Run with `yarn tauri dev`

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

### File structure

In order to bundle the server into tauri, we use symlinks to put our main project into the `tauri` folder.
Here's what is expected:
- tauri
  - node-server
    - theopenpresenter (this repo, without `tauri`)

This is achieved through manual symlinks on each of the files inside the repo, except for the `tauri` folder. This can be re-linked by running `yarn`.

## Fragility

As can be seen, there are plenty of things that need to happen for the app to run smoothly. A small change somewhere in the build system could easily break this.

There are also a few places where we've essentially copied the code with some modification.

Anytime we modify the following, we should check that everything still runs:
- Modification to docker production build
- Update to postgres (extension, version, etc)

## Other notable limitations / shortcomings that we need to address

- It takes a long time for the node server to start
- Frontend logs not saved anywhere
- Error not logged nor shown when node initialization fails
- Opening multiple instance of the app won't work well due to port clashing

Domain issues: 
- Fix trpc not working when accessed from different domain
- Fix media (eg: google slide img) doesn't load when accessed from different domain

Nice to have:
- No option to stop presenting
- Worker needs to be configured better. Eg: Email, etc
- We currently still include the sourcecode in the bundle. We'd want to remove this.
- We need to make it easier for user to configure the server (eg: for plugin env)

### Linux and MacOS support

- PG extension binary
  - Currently, the PG extension we use are only compiled for 64bit linux and windows. For supporting other platform & arch, we'd need to build its binaries and include it somehow.
  - Note that for Windows, we've manually included the .dll file in this repo
- Yaml build
  - The github action .yaml is setup for Windows only. We'd need to change this to build other platforms too.