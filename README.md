# Cropalot 📸✂️

> **Privacy-First, 100% Offline Multi-Photo Auto-Crop & Deskew Tool for Digitizing Family Photo Sheets**

**Cropalot** is a high-performance web application designed to automatically detect, separate, auto-crop, and deskew individual photographs scanned or photographed together on a single album sheet or flatbed scanner. Everything runs **100% locally in the browser** using client-side HTML5 Canvas and WebAssembly algorithms — zero photo data ever leaves your computer or mobile device.

---

## 🌟 Key Features

- **⚡ Instant Multi-Photo Detection**: Automatically scans image sheets and isolates multiple photos into individual bounding quadrilaterals.
- **📐 Auto-Deskew & Perspective Correction**: Detects rotation angles and applies inverse perspective transformations to square up crooked scans.
- **🎯 Precision Corner Editing**: Interactive 4-point corner drag controls and fine-tuning handles for pixel-perfect adjustments when automatic detection needs tweaking.
- **🔒 Private & Offline First**: Zero server uploads, zero remote tracking, zero analytics scripts. Fully operational without an internet connection.
- **📦 Batch Zip Export**: Export individual high-quality crops in PNG or JPEG format with customizable compression and metadata options in a single `.zip` download.
- **📱 Responsive & Mobile-Optimized**: Supports camera capture directly from mobile devices and desktop webcams, alongside a preview mode for desktop and Android layouts.
- **✨ Sample Sheet Testing**: Built-in test photo sheets allowing instant testing without needing immediate uploads.

---

## 🛡️ Privacy & Security Architecture

Cropalot was built from the ground up for absolute privacy:

1. **Client-Side Execution**: All image manipulation (pixel analysis, edge detection, perspective warp transformations, and file compression) is performed entirely on your CPU/GPU via client-side JavaScript, WebAssembly, and Canvas API.
2. **Zero Telemetry**: No third-party analytics (e.g., Google Analytics, Mixpanel, Sentry) or tracking cookies are included.
3. **No External API Dependencies**: Does not send photos or metadata to cloud endpoints or AI models.
4. **Air-Gap Capable**: Once loaded, the application operates completely air-gapped without needing any network connectivity.

---

## 🔬 Computer Vision & Processing Pipeline

The image processing pipeline follows these technical steps:

1. **Image Preprocessing & Downscaling**:
   - The original image sheet is ingested onto an offscreen canvas and downscaled for high-speed edge detection analysis while preserving original resolution references for final export renders.

2. **Contrast & Color Quantization**:
   - Analyzes pixel luminosity variances across background photo album pages or scanner beds to distinguish photo boundaries from backing material.

3. **Bounding Quadrilateral Detection**:
   - Identifies candidate photo regions, calculates minimum bounding rectangles, and extracts top-left, top-right, bottom-right, and bottom-left coordinate vectors.

4. **Homography & Perspective Transformation**:
   - Maps arbitrary 4-point quadrilateral selections back to rectangular coordinate spaces, compensating for tilt, skew, and perspective distortion caused by camera angles.

5. **Resolution Loss Prevention**:
   - Crops are rendered directly from source resolution image buffers during export, ensuring full dpi fidelity is retained.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Lucide React Icons
- **Animation**: Motion (`motion/react`)
- **Archiving & Download**: JSZip, FileSaver.js
- **Runtime**: Client-side Node.js / Vite build environment with Express fallback middleware

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.x` or higher
- **npm**: `v9.x` or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/cropalot.git
   cd cropalot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000`.

### Scripts

- `npm run dev` - Starts local Vite dev server on port 3000.
- `npm run build` - Builds production distribution artifacts in `dist/`.
- `npm run lint` - Runs TypeScript type check (`tsc --noEmit`).

---

## 📂 Project Structure

```
cropalot/
├── public/                 # Static assets & icons
├── src/
│   ├── components/         # UI Components
│   │   ├── Navbar.tsx      # Application header & navigation
│   │   ├── SheetUploader.tsx# Drag-and-drop & sample loader
│   │   ├── CropEditor.tsx  # Main interactive canvas editor
│   │   ├── PhotoGallery.tsx# Extracted photo gallery & export
│   │   ├── SettingsModal.tsx# Application configuration dialog
│   │   ├── SupportModal.tsx # Development support & credits pop-out
│   │   └── ...
│   ├── utils/              # Computer vision & processing algorithms
│   │   ├── autoCropEngine.ts# Edge detection & quad processing
│   │   ├── sampleSheets.ts  # Pre-built sample photo sheets
│   │   └── ...
│   ├── types.ts            # Global TypeScript definitions
│   ├── App.tsx             # Main application state & workflow coordinator
│   └── main.tsx            # Application entry point
├── metadata.json           # Applet permissions & capabilities
├── package.json            # Project dependencies & scripts
└── README.md               # Project documentation
```

---

## 💖 Support Development & Acknowledgments

Cropalot is **100% free software** with no subscriptions, ads, or paywalls.

If Cropalot helped you digitize family photo albums or save hours of manual cropping, consider supporting ongoing development:

👉 **[Support Development via PayPal](https.www.paypal.com/donate/?hosted_button_id=JLAGXTV4FX96S)**

### 🏢 Special Thanks & Shout-Out

Special thanks to **[Halo MSP](https://halomsp.com)** — helping businesses with safe and sensible AI and software implementation.

For general business IT needs, check out our parent company **[Tech 2U](https://tech2u.com)** for assistance with any IT requirement.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more details.
