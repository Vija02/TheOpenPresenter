export const DEV_NONCE = "dev";

export const getImportMap = (
  nonce: string,
) => `<script type="importmap" nonce="${nonce}">
    {
      "imports": {
        "yjs": "https://ga.jspm.io/npm:yjs@13.6.8/dist/yjs.mjs"
      },
      "scopes": {
        "https://ga.jspm.io/": {
          "lib0/array": "https://ga.jspm.io/npm:lib0@0.2.94/array.js",
          "lib0/binary": "https://ga.jspm.io/npm:lib0@0.2.94/binary.js",
          "lib0/buffer": "https://ga.jspm.io/npm:lib0@0.2.94/buffer.js",
          "lib0/decoding": "https://ga.jspm.io/npm:lib0@0.2.94/decoding.js",
          "lib0/encoding": "https://ga.jspm.io/npm:lib0@0.2.94/encoding.js",
          "lib0/error": "https://ga.jspm.io/npm:lib0@0.2.94/error.js",
          "lib0/function": "https://ga.jspm.io/npm:lib0@0.2.94/function.js",
          "lib0/iterator": "https://ga.jspm.io/npm:lib0@0.2.94/iterator.js",
          "lib0/logging": "https://ga.jspm.io/npm:lib0@0.2.94/logging.js",
          "lib0/map": "https://ga.jspm.io/npm:lib0@0.2.94/map.js",
          "lib0/math": "https://ga.jspm.io/npm:lib0@0.2.94/math.js",
          "lib0/object": "https://ga.jspm.io/npm:lib0@0.2.94/object.js",
          "lib0/observable": "https://ga.jspm.io/npm:lib0@0.2.94/observable.js",
          "lib0/promise": "https://ga.jspm.io/npm:lib0@0.2.94/promise.js",
          "lib0/random": "https://ga.jspm.io/npm:lib0@0.2.94/random.js",
          "lib0/set": "https://ga.jspm.io/npm:lib0@0.2.94/set.js",
          "lib0/string": "https://ga.jspm.io/npm:lib0@0.2.94/string.js",
          "lib0/time": "https://ga.jspm.io/npm:lib0@0.2.94/time.js",
          "lib0/webcrypto": "https://ga.jspm.io/npm:lib0@0.2.94/webcrypto.js"
        }
      }
    }
  </script>`;
