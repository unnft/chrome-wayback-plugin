const fs = require('fs');
const path = require('path');

// Read the SVG file
const svgContent = fs.readFileSync(path.join(__dirname, 'images', 'icon.svg'), 'utf8');

// Function to create a data URI for our SVG
const svgToDataUri = (svg) => {
  const encoded = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
};

// Function to create an HTML file that will help us convert SVG to PNG
const createHtmlForConversion = (size) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Convert SVG to PNG</title>
</head>
<body>
  <img id="source" src="${svgToDataUri(svgContent)}" width="${size}" height="${size}">
  <canvas id="canvas" width="${size}" height="${size}" style="display:none;"></canvas>
  <div id="output"></div>
  
  <script>
    // Wait for image to load
    const img = document.getElementById('source');
    img.onload = function() {
      // Draw image on canvas
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, ${size}, ${size});
      
      // Get data URL
      const dataUrl = canvas.toDataURL('image/png');
      
      // Display result
      document.getElementById('output').textContent = dataUrl;
    };
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync(path.join(__dirname, `convert_${size}.html`), html);
  console.log(`Created HTML converter for ${size}x${size} icon. Open this file in a browser.`);
};

// Create HTML files for different icon sizes
createHtmlForConversion(16);
createHtmlForConversion(48);
createHtmlForConversion(128);

console.log('Instructions:');
console.log('1. Open each convert_XX.html file in a browser');
console.log('2. Copy the data URL output (long string starting with data:image/png;base64,)');
console.log('3. Use a base64 to PNG converter online to get the image files');
console.log('4. Save the resulting PNGs as icon16.png, icon48.png, and icon128.png in the images folder');