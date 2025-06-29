const fs = require('fs');
const { minify } = require('terser');

async function build() {
  try {
    const inputCode = fs.readFileSync('resonant.js', 'utf8');
    
    const result = await minify(inputCode, {
      compress: {
        dead_code: true,
        drop_console: false,
        drop_debugger: true,
        keep_fargs: false,
        unused: true
      },
      mangle: {
        toplevel: false
      },
      output: {
        comments: false
      }
    });

    if (result.error) {
      console.error('Minification error:', result.error);
      process.exit(1);
    }

    fs.writeFileSync('resonant.min.js', result.code);
    console.log('resonant.min.js created with proper minification');
    
    const originalSize = inputCode.length;
    const minifiedSize = result.code.length;
    const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);
    console.log(`Size reduction: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
