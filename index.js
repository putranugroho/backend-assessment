const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
const PORT = 3000;

app.use(express.json());

const thumbnailCache = {};

// Function to download video from URL
async function downloadVideo(url, outputPath) {
  const response = await axios.get(url, { responseType: "stream" });
  return new Promise((resolve, reject) => {
    const stream = response.data.pipe(fs.createWriteStream(outputPath));
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// Function to extract key frames and generate animated thumbnail
function generateAnimatedThumbnail(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        "fps=1,scale=320:-1:flags=lanczos",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
      ])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

// Function to download video from URL
async function downloadVideo(url, outputPath) {
  const response = await axios.get(url, { responseType: "stream" });
  return new Promise((resolve, reject) => {
    const stream = response.data.pipe(fs.createWriteStream(outputPath));
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// Function to extract video metadata
function extractMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const format = metadata.format;
        const stream = metadata.streams.find((s) => s.codec_type === "video");
        resolve({
          duration: format.duration,
          resolution: `${stream.width}x${stream.height}`,
          codec: stream.codec_name,
          bitrate: format.bit_rate,
          frameRate: stream.r_frame_rate,
        });
      }
    });
  });
}

// API Endpoint to process video URL
app.post("/api/generate-thumbnail", async (req, res) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL is required" });
  }

  try {
    // Check cache
    if (thumbnailCache[videoUrl]) {
      return res.json({ thumbnail: thumbnailCache[videoUrl] });
    }

    // Define paths
    const videoPath = path.join(__dirname, "temp", "video.mp4");
    const thumbnailPath = path.join(
      __dirname,
      "temp",
      "animated_thumbnail.mp4"
    );

    if (!fs.existsSync(path.join(__dirname, "temp"))) {
      fs.mkdirSync(path.join(__dirname, "temp"));
    }

    await downloadVideo(videoUrl, videoPath);

    await generateAnimatedThumbnail(videoPath, thumbnailPath);

    thumbnailCache[videoUrl] = thumbnailPath;
    res.json({ thumbnail: thumbnailPath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process video" });
  }
});

// API Endpoint to process video URL and extract metadata
app.post("/api/extract-metadata", async (req, res) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL is required" });
  }

  try {
    // Define paths
    const videoPath = path.join(__dirname, "temp", "video.mp4");

    // Ensure temp directory exists
    if (!fs.existsSync(path.join(__dirname, "temp"))) {
      fs.mkdirSync(path.join(__dirname, "temp"));
    }

    // Download video
    await downloadVideo(videoUrl, videoPath);

    // Extract metadata
    const metadata = await extractMetadata(videoPath);

    // Respond with metadata
    res.json(metadata);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process video" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
