const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const { execSync } = require('child_process');

async function runTests() {
  try {
    console.log('Running core tests...');
    const testDir = path.join(__dirname, '..', 'test');
    const skipTests = new Set(['input_binding.test.js', 'error_handling.test.js', 'input_binding_advanced.test.js']);
    const testFiles = fs.readdirSync(testDir)
      .filter(f => f.endsWith('.test.js') && !skipTests.has(f))
      .map(f => path.join('test', f))
      .join(' ');
    execSync(`node --test --test-force-exit --test-timeout=30000 ${testFiles}`, { stdio: 'inherit', timeout: 120000 });
    console.log('✓ Core tests passed');
  } catch (error) {
    console.error('✗ Core tests failed');
    process.exit(1);
  }
}

async function build() {
  try {
    const inputCode = fs.readFileSync('resonant.js', 'utf8');
    
    const result = await minify(inputCode, {
      compress: {
        arguments: true,
        booleans: true,
        collapse_vars: true,
        comparisons: true,
        computed_props: true,
        conditionals: true,
        dead_code: true,
        drop_console: false,
        drop_debugger: true,
        evaluate: true,
        hoist_funs: true,
        hoist_props: true,
        hoist_vars: false,
        if_return: true,
        inline: true,
        join_vars: true,
        keep_fargs: false,
        loops: true,
        negate_iife: true,
        properties: true,
        reduce_funcs: true,
        reduce_vars: true,
        sequences: true,
        side_effects: true,
        switches: true,
        typeofs: true,
        unused: true
      },
      mangle: {
        toplevel: false,
        eval: true,
        keep_fnames: false,
        properties: false
      },
      output: {
        comments: false,
        beautify: false,
        semicolons: true
      },
      sourceMap: {
        filename: 'resonant.min.js',
        url: 'resonant.min.js.map'
      }
    });

    if (result.error) {
      console.error('Minification error:', result.error);
      process.exit(1);
    }

    fs.writeFileSync('resonant.min.js', result.code);
    fs.writeFileSync('resonant.min.js.map', result.map);
    console.log('✓ resonant.min.js created with enhanced minification');
    console.log('✓ resonant.min.js.map source map created');
    
    const originalSize = inputCode.length;
    const minifiedSize = result.code.length;
    const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);
    console.log(`Size reduction: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function main() {
  await runTests();
  await build();
}

main().catch(error => {
  console.error('Build process failed:', error);
  process.exit(1);
});
