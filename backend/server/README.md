# Server

## Upgrading Dependencies

For performance and compatibility reasons, we import some dependencies through importmaps. This allows us to use a central reference of the dependency rather than bundling it multiple times.

For now, we download the dependency manually and put them into the server public assets file. 

For react, we use the esm.sh source and copy them manually. Here's an example of the link:  
Eg: `https://esm.sh/react@19.1.0/es2018/react.mjs`

For yjs, we bundle an esm build from this repo: https://github.com/Vija02/yjs-esm

Because of this, these dependencies will need to be updated manually when we want to upgrade it.