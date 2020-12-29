import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/index.ts',
  sourcemap: 'inline',
  output: [
    {
      name: 'post-me',
      file: 'dist/index.umd.js',
      format: 'umd'
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm'
    }
  ],
  // plugins: [typescript({ 
  //   tsconfigOverride: {
  //     compilerOptions: { 
  //       sourceMap: true, 
  //       inlineSourceMap: true,
  //     },
  //   },
  // })]
  plugins: [typescript()]
}
