# 🛡️ Hide_Text_In_Img_Using_Steganography

**[🌐 Open the App (Live Demo)](https://mohanraj9342.github.io/Hide_Text_In_Img_Using_Steganography/)**

A modern, entirely client-side web application to **hide (encode)** and **reveal (decode)** secret messages in images using the Least Significant Bit (LSB) steganography technique.  
Built with HTML, CSS, and vanilla JavaScript, this app runs entirely in your browser. It also supports optional password-based encryption using the native Web Crypto API (AES-GCM) for enhanced security without sending any data to a server.

---

## 🚀 Features

- **100% Client-Side & Private:** No server uploads, no data stored.
- **Hide Secret Messages:** Embed text messages inside images (PNG/JPG) using LSB steganography.
- **Password Encryption (Optional):** Encrypt your secret message with a password before hiding it using AES-GCM encryption.
- **Reveal & Decrypt:** Extract and optionally decrypt hidden messages from images.
- **User-Friendly UI:** Clean, dark-themed interface with drag-and-drop support, image previews, and progress bars.
- **Download Options:** Download the lossless stego image and extracted messages.

---

## 📸 How It Works

### Encoding (Hiding a Message)
1. **Upload** a cover image (PNG recommended).
2. **Enter** your secret message.
3. *(Optional)* **Encrypt** your message with a password for extra security.
4. **Click** "Encode Message" to embed the message in the image's pixels.
5. **Download** the resulting stego image.

### Decoding (Revealing a Message)
1. **Upload** a stego image (an image with a hidden message).
2. *(Optional)* **Enter** the password if the message was encrypted.
3. **Click** "Reveal Message" to extract (and decrypt) the hidden data.
4. **Download** or **Copy** the extracted message.

---

## 🛠️ Usage

Since this app is purely frontend-based, there is no complicated installation or backend server required.

### Option 1: Use the Live Site
Simply visit the live GitHub Pages link:  
👉 **[https://mohanraj9342.github.io/Hide_Text_In_Img_Using_Steganography/](https://mohanraj9342.github.io/Hide_Text_In_Img_Using_Steganography/)**

### Option 2: Run Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/mohanraj9342/Hide_Text_In_Img_Using_Steganography.git
   cd Hide_Text_In_Img_Using_Steganography
   ```
2. Open `index.html` in any modern web browser.

---

## 📂 Project Structure

```text
.
├── index.html           # Main application UI
├── style.css            # Styling and animations
├── app.js               # Steganography and encryption logic
├── README.md            # This documentation
└── .gitignore           # Git ignore rules
```

---

## ⚡ Requirements

- Any modern web browser (Chrome, Firefox, Safari, Edge) with JavaScript enabled.

---

## 📝 Notes & Best Practices

- **Image Format:** PNG is strongly recommended for the cover image. JPG uses lossy compression which can destroy the hidden bits during saving/sharing.
- **Message Length:** The maximum message length depends on the physical dimensions (width × height) of the uploaded image.
- **Security:** Standard LSB steganography only *hides* data. For sensitive information, always enable the password encryption option.

---

## 🙋‍♂️ Author

**Mohanraj Velayutham**  
[GitHub Profile](https://github.com/mohanraj9342)

---

## 📃 License

This project is for educational and demonstration purposes.