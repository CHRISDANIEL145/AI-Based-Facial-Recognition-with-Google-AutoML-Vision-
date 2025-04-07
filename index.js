// Import required libraries
const vision = require('@google-cloud/vision');
const fs = require('fs');
const http = require('http');
const express = require('express');
const multer = require('multer');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const WebSocket = require('ws');
const { exec } = require('child_process');

// Create a Vision client
const client = new vision.ImageAnnotatorClient({
  keyFilename: 'sapient-torch-456008-q9-6bc6576e3863.json',
});

// Initialize express application
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure storage for temporary image captures
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync('./captures')) {
      fs.mkdirSync('./captures');
    }
    cb(null, './captures/');
  },
  filename: function (req, file, cb) {
    cb(null, 'capture-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Serve static files
app.use(express.static('public'));
app.use('/captures', express.static('captures'));

// Create HTML interface for camera access
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to process image
app.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    const imagePath = req.file.path;
    const result = await detectFaceAttributes(imagePath);
    res.json(result);
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket for live streaming
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', async (message) => {
    try {
      // Convert the received binary data to a base64 string
      const base64Image = message.toString().split(',')[1];
      const buffer = Buffer.from(base64Image, 'base64');
      
      // Save the image temporarily
      const imagePath = `./captures/temp-${Date.now()}.jpg`;
      fs.writeFileSync(imagePath, buffer);
      
      // Process the image
      const result = await detectFaceAttributes(imagePath);
      
      // Send back the result
      ws.send(JSON.stringify(result));
      
      // Clean up the temporary file
      fs.unlinkSync(imagePath);
    } catch (error) {
      console.error('Error processing WebSocket image:', error);
      ws.send(JSON.stringify({ error: error.message }));
    }
  });
});

// Face detection function with gender classification
async function detectFaceAttributes(imagePath) {
  try {
    // Perform face detection with detailed attributes
    const [result] = await client.faceDetection(imagePath);
    const faces = result.faceAnnotations || [];
    
    const detectedFaces = faces.map((face, index) => {
      // Get gender prediction based on facial features
      // Note: Google Vision API doesn't directly provide gender, so we're using likelihood factors
      
      // These are approximations as Vision API doesn't explicitly return gender
      // In a production system, you'd want to use a dedicated gender classification model
      const joyLikelihood = convertLikelihoodToNum(face.joyLikelihood);
      const angerLikelihood = convertLikelihoodToNum(face.angerLikelihood);
      const sorrowLikelihood = convertLikelihoodToNum(face.sorrowLikelihood);
      
      // Using face detection metrics to estimate gender (note: this is an approximation)
      // A more accurate approach would use a dedicated gender classification model
      let gender = 'Unknown';
      
      // This is a simplified approach - actual gender detection requires a specialized model
      // Creating a rough approximation based on available features
      const landmarks = face.landmarks || [];
      
      // Calculate approximate face proportions based on landmarks
      // This is a very simplified approach and not reliable for actual gender detection
      if (landmarks.length > 0) {
        // For demo purposes only - not scientifically accurate
        const faceWidth = Math.abs(getBoundingPoly(face).vertices[1].x - getBoundingPoly(face).vertices[0].x);
        const faceHeight = Math.abs(getBoundingPoly(face).vertices[2].y - getBoundingPoly(face).vertices[0].y);
        const aspectRatio = faceWidth / faceHeight;
        
        // These are purely demonstrative thresholds and NOT scientifically accurate
        // In a real application, use a proper gender classification model instead
        if (aspectRatio > 0.85) {
          gender = 'Male (estimated)';
        } else {
          gender = 'Female (estimated)';
        }
      }
      
      return {
        faceId: index + 1,
        gender,
        boundingBox: getBoundingPoly(face),
        landmarks: face.landmarks,
        emotions: {
          joy: joyLikelihood,
          anger: angerLikelihood,
          sorrow: sorrowLikelihood,
          surprise: convertLikelihoodToNum(face.surpriseLikelihood)
        },
        confidence: face.detectionConfidence
      };
    });
    
    // Generate an annotated image
    let annotatedImagePath = null;
    if (faces.length > 0) {
      annotatedImagePath = await annotateImage(imagePath, detectedFaces);
    }
    
    return {
      totalFaces: faces.length,
      faces: detectedFaces,
      annotatedImage: annotatedImagePath ? `/captures/${path.basename(annotatedImagePath)}` : null
    };
  } catch (err) {
    console.error('Error in face detection,:', err);
    throw err;
  }
}

// Helper function to convert likelihood enum to numeric value
function convertLikelihoodToNum(likelihood) {
  const likelihoodMap = {
    'UNKNOWN': 0,
    'VERY_UNLIKELY': 0.1,
    'UNLIKELY': 0.3,
    'POSSIBLE': 0.5,
    'LIKELY': 0.7,
    'VERY_LIKELY': 0.9
  };
  
  return likelihoodMap[likelihood] || 0;
}

// Helper function to get bounding box
function getBoundingPoly(face) {
  return face.boundingPoly || face.fdBoundingPoly;
}

// Function to annotate the image with detection results
async function annotateImage(imagePath, faces) {
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the original image
    ctx.drawImage(image, 0, 0, image.width, image.height);
    
    // Draw rectangles and labels for each face
    faces.forEach(face => {
      const box = face.boundingBox;
      const vertices = box.vertices;
      
      // Calculate coordinates
      const x = vertices[0].x || 0;
      const y = vertices[0].y || 0;
      const width = ((vertices[1].x || image.width) - x);
      const height = ((vertices[2].y || image.height) - y);
      
      // Draw rectangle
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      // Add label with gender
      ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
      ctx.fillRect(x, y - 20, width, 20);
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText(`${face.gender}`, x + 5, y - 5);
    });
    
    // Save the annotated image
    const annotatedPath = imagePath.replace(path.extname(imagePath), '-annotated' + path.extname(imagePath));
    const out = fs.createWriteStream(annotatedPath);
    const stream = canvas.createJPEGStream();
    stream.pipe(out);
    
    return new Promise((resolve, reject) => {
      out.on('finish', () => resolve(annotatedPath));
      out.on('error', (err) => reject(err));
    });
  } catch (err) {
    console.error('Error annotating image:', err);
    return null;
  }
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  
  // Open browser automatically
  const startBrowser = process.platform === 'win32' ? 
    'start' : process.platform === 'darwin' ? 
    'open' : 'xdg-open';
  
  exec(`${startBrowser} http://localhost:${PORT}`);
});
