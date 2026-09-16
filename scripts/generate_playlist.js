const fs = require('fs');
const path = require('path');
const { parseFile } = require('music-metadata');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg']);
const SONGS_DIR = path.join(__dirname, '..', 'songs');
const OUTPUT_FILE = path.join(__dirname, '..', 'songs.json');

function cleanTitle(filename) {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .trim();
}

async function getDuration(filePath) {
  try {
    const metadata = await parseFile(filePath);
    return Math.round(metadata.format.duration || 0);
  } catch (err) {
    console.warn(`  ⚠ Could not read duration for ${path.basename(filePath)}: ${err.message}`);
    return 0;
  }
}

async function generatePlaylist() {
  if (!fs.existsSync(SONGS_DIR)) {
    console.error(`Error: songs/ directory not found at ${SONGS_DIR}`);
    console.error('Create a songs/ folder and add your audio files first.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(SONGS_DIR)
    .filter((name) => AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (files.length === 0) {
    console.warn('No audio files found in songs/. Writing empty playlist.');
    fs.writeFileSync(OUTPUT_FILE, '[]\n', 'utf8');
    return;
  }

  console.log(`Scanning ${files.length} audio file(s)...`);

  const playlist = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(SONGS_DIR, filename);
    const duration = await getDuration(filePath);

    playlist.push({
      id: i + 1,
      title: cleanTitle(filename),
      src: `songs/${filename}`,
      duration
    });

    console.log(`  ✓ ${filename} (${duration}s)`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(playlist, null, 2) + '\n', 'utf8');

  const totalDuration = playlist.reduce((sum, t) => sum + t.duration, 0);
  console.log(`\nDone! Wrote ${playlist.length} tracks to songs.json (${totalDuration}s total)`);
}

generatePlaylist().catch((err) => {
  console.error('Failed to generate playlist:', err);
  process.exit(1);
});
