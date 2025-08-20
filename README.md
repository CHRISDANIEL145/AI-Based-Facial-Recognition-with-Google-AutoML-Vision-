# AI-Based Facial Recognition with Google AutoML Vision (Node.js)

This Node.js application integrates with Google AutoML Vision API for facial recognition, allowing users to analyze facial images using a model trained in Google Cloud's AutoML Vision platform.

## Project Structure

```
google-cloud-vision-api/
│
├── captures/                    # Folder to save or upload captured images
├── node_modules/                # Node dependencies
├── public/                      # Static frontend files (HTML/CSS/JS)
├── .gitignore                   # Files to be ignored in Git
├── index.js                     # Main server-side code
├── package.json                 # Node.js dependencies and scripts
├── package-lock.json            # Lockfile
├── README.md                    # This documentation
└── sapient-torch-456008-q9-6bc6576e3863.json  # Google Cloud service account key
```

## Features

- Facial image prediction using Google AutoML Vision
- Fast Node.js backend for image processing
- API integration with Google Cloud
- Supports image uploads and cloud-based inference

## Technologies Used

- Node.js & Express
- Google Cloud AutoML Vision API
- Multer (for image uploads)
- dotenv (for environment variables)
- Google Cloud SDK

## Prerequisites

Before you begin, ensure you have the following:

1. A Google Cloud Platform account
2. A trained AutoML Vision model for facial recognition
3. Node.js installed on your system
4. A service account key with appropriate permissions

## Setup and Installation

### 1. Clone the Repository

```bash
git clone https://github.com/CHRISDANIEL145/AI-Based-Facial-Recognition-with-Google-AutoML-Vision-.git
cd AI-Based-Facial-Recognition-with-Google-AutoML-Vision-
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Google Cloud Authentication

Rename your service account key file for clarity:

```bash
mv sapient-torch-456008-q9-6bc6576e3863.json serviceAccountKey.json
```

### 4. Create Environment Variables

Create a `.env` file in the root directory with the following content:

```
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json
PROJECT_ID=YOUR_PROJECT_ID
MODEL_ID=your-automl-model-id
REGION=us-central1
```

Replace `your-automl-model-id` with your actual model ID from Google Cloud AutoML Vision.

### 5. Create Required Directories

Ensure you have the necessary directories:

```bash
mkdir -p captures public
```

### 6. Create a Basic Frontend

Create a file `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facial Recognition with Google AutoML Vision</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 5px;
        }
        .result {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            display: none;
        }
        .preview {
            max-width: 300px;
            margin-top: 10px;
        }
        button {
            padding: 10px 15px;
            background-color: #4285f4;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 10px;
        }
        button:hover {
            background-color: #3367d6;
        }
        #loading {
            display: none;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <h1>Facial Recognition with Google AutoML Vision</h1>
    
    <div class="container">
        <h2>Upload Image for Analysis</h2>
        <form id="upload-form" enctype="multipart/form-data">
            <div>
                <label for="image">Select an image:</label>
                <input type="file" id="image" name="image" accept="image/*" required>
            </div>
            <div>
                <img id="preview" class="preview" alt="Preview will appear here" style="display: none;">
            </div>
            <button type="submit">Analyze Face</button>
            <div id="loading">Processing... Please wait.</div>
        </form>
    </div>

    <div id="result" class="result">
        <h3>Analysis Results:</h3>
        <div id="result-content"></div>
    </div>

    <script>
        document.getElementById('image').addEventListener('change', function(e) {
            const preview = document.getElementById('preview');
            const file = e.target.files[0];
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    preview.src = event.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('upload-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const loadingElement = document.getElementById('loading');
            const resultElement = document.getElementById('result');
            const resultContentElement = document.getElementById('result-content');
            
            loadingElement.style.display = 'block';
            resultElement.style.display = 'none';
            
            const formData = new FormData(this);
            
            try {
                const response = await fetch('/predict', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error('Server error: ' + response.status);
                }
                
                const data = await response.json();
                
                // Display results
                let resultHtml = '<ul>';
                if (data && data.length > 0) {
                    data.forEach(prediction => {
                        resultHtml += `<li>${prediction.displayName}: ${(prediction.classification.score * 100).toFixed(2)}%</li>`;
                    });
                } else {
                    resultHtml += '<li>No faces detected or recognized.</li>';
                }
                resultHtml += '</ul>';
                
                resultContentElement.innerHTML = resultHtml;
                resultElement.style.display = 'block';
            } catch (error) {
                console.error('Error:', error);
                resultContentElement.innerHTML = `<p>Error: ${error.message}</p>`;
                resultElement.style.display = 'block';
            } finally {
                loadingElement.style.display = 'none';
            }
        });
    </script>
</body>
</html>
```

### 7. Run the Application

```bash
node index.js
```

Your application will start on `http://localhost:3000` (or the configured port).

## Full Server Code (index.js)

```javascript
const express = require('express');
const multer = require('multer');
const { PredictionServiceClient } = require('@google-cloud/automl').v1;
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'captures/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, JPG, and PNG image files are allowed'));
  }
});

// Initialize Google Cloud AutoML client
const client = new PredictionServiceClient();

// Get environment variables
const projectId = process.env.PROJECT_ID;
const modelId = process.env.MODEL_ID;
const location = process.env.REGION || 'us-central1';

// Serve static files from public directory
app.use(express.static('public'));

// API endpoint for image prediction
app.post('/predict', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    try {
        const filePath = path.join(__dirname, req.file.path);
        const modelFullId = client.modelPath(projectId, location, modelId);
        
        // Read the image file
        const content = fs.readFileSync(filePath);
        
        // Create prediction payload
        const payload = {
            payload: {
                image: { imageBytes: content },
            },
        };
        
        // Make prediction request
        const [response] = await client.predict({ 
            name: modelFullId, 
            ...payload 
        });
        
        console.log('Prediction results:');
        console.log(response.payload);
        
        res.json(response.payload);
    } catch (err) {
        console.error('Prediction error:', err);
        res.status(500).send('Prediction failed: ' + err.message);
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});
```

## .gitignore File

```
# Dependencies
node_modules/

# Environment variables
.env

# Google Cloud credentials and keys
*.json

# Uploaded and captured images
captures/

# System Files
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
```

## package.json

```json
{
  "name": "google-cloud-vision-api",
  "version": "1.0.0",
  "description": "AI-Based Facial Recognition with Google AutoML Vision",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "google-cloud",
    "automl",
    "vision",
    "facial-recognition",
    "node",
    "express"
  ],
  "author": "CHRIS DANIEL",
  "license": "MIT",
  "dependencies": {
    "@google-cloud/automl": "^4.0.0",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

## Google Cloud AutoML Vision Setup Guide

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project" and enter a name for your project
3. Note your Project ID (in your case, it's "sapient-torch-456008")

### 2. Enable the AutoML Vision API

1. Go to "APIs & Services" > "Library"
2. Search for "AutoML Vision"
3. Click on "Cloud AutoML API" and enable it

### 3. Create a Service Account

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Provide a name and description
4. Grant the following roles:
   - AutoML Admin
   - Storage Admin
   - Service Account User
5. Click "Done"

### 4. Create and Download a Service Account Key

1. Find your service account in the list
2. Click the three dots menu (⋮) > "Manage keys"
3. Click "Add Key" > "Create new key"
4. Select JSON format and click "Create"
5. The key file will be downloaded (this is your `sapient-torch-456008-q9-6bc6576e3863.json` file)

### 5. Create and Train Your AutoML Vision Model

1. Go to the [AutoML Vision console](https://console.cloud.google.com/vision)
2. Create a new dataset
3. Upload and label your facial recognition images
4. Train your model
5. Note your Model ID for the `.env` file

## Usage Instructions

1. Upload an image through the web interface
2. The system will process the image and send it to Google Cloud for analysis
3. Results will display showing the recognized faces and confidence scores

## Troubleshooting

### Common Issues:

1. **Authentication Errors**: 
   - Ensure your service account key is correctly referenced in the `.env` file
   - Verify the key has not expired

2. **Model ID Issues**:
   - Double-check your model ID in the `.env` file
   - Ensure the model is deployed and available

3. **Permission Errors**:
   - Verify your service account has the correct permissions
   - Check if the API is enabled in your Google Cloud Console

4. **Image Upload Issues**:
   - Check that the `captures` directory exists and is writable
   - Ensure uploaded images meet size and format requirements

### Getting Help:

- Check the [Google Cloud AutoML Vision documentation](https://cloud.google.com/vision/automl/docs)
- Review the logs in your Google Cloud Console
- Consult the [Node.js client library documentation](https://googleapis.dev/nodejs/automl/latest/)

## License

This project is licensed under the MIT License.

## Author

**CHRIS DANIEL**  
GitHub: [CHRISDANIEL145](https://github.com/CHRISDANIEL145)


