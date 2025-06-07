# 🛡️ Hide_Text_In_Img_Using_Steganography

**[🌐 Open the App in Streamlit](https://mohanraj9342-hide-text-in-img-using-steganograph-project-lksvdn.streamlit.app/)**

A modern web application to **hide (encode)** and **reveal (decode)** secret messages in images using the Least Significant Bit (LSB) steganography technique.  
Built with [Streamlit](https://streamlit.io/) and Python, this app also supports optional password-based encryption for enhanced security.

---

## 🚀 Features

- **Hide Secret Messages:** Embed text messages inside images (PNG/JPG) using LSB steganography.
- **Password Encryption (Optional):** Encrypt your secret message with a password before hiding it.
- **Reveal & Decrypt:** Extract and optionally decrypt hidden messages from images.
- **User-Friendly UI:** Clean, dark-themed interface with image previews and progress bars.
- **Download Options:** Download the stego image and extracted messages.
- **Reset & Info:** Easily reset the app and get usage instructions.
- **About & Author Info:** Sidebar with app details and author’s GitHub link.

---

## 📸 How It Works

### Encoding (Hiding a Message)
1. **Upload** a cover image (PNG/JPG recommended; PNG is best for lossless hiding).
2. **Enter** your secret message.
3. *(Optional)* **Encrypt** your message with a password for extra security.
4. **Click** "Encode Message" to embed the message in the image.
5. **Download** the stego image with the hidden message.

### Decoding (Revealing a Message)
1. **Upload** a stego image (an image with a hidden message).
2. *(Optional)* **Enter** the password if the message was encrypted.
3. **Click** "Reveal Message" to extract (and decrypt) the hidden message.
4. **Download** the extracted message as a text file.

---

## 🛠️ Installation & Usage

### 1. Clone the Repository

```bash
git clone https://github.com/mohanraj9342/Hide_Text_In_Img_Using_Steganography.git
cd Hide_Text_In_Img_Using_Steganography
```

### 2. Install Dependencies

It’s recommended to use a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the App

```bash
streamlit run project.py
```

---

## 📂 Project Structure

```
.
├── project.py           # Main Streamlit app
├── requirements.txt     # Python dependencies
├── .gitignore           # Git ignore rules
├── README.md            # This file
```

---

## ⚡ Requirements

- Python 3.7+
- See `requirements.txt` for Python packages:
    - streamlit
    - pillow
    - cryptography

---

## 📝 Notes & Best Practices

- **Image Format:** PNG is recommended for best results. JPG is supported but may corrupt hidden data due to compression.
- **Message Length:** The maximum message length depends on the image size. The app will inform you of the limit.
- **Security:** LSB steganography hides data but does not encrypt it. For sensitive information, always use the password encryption option.
- **Dark Mode:** The app uses a dark theme for a modern look and better readability.

---

## 🙋‍♂️ Author

**Mohanraj Velayutham**  
[GitHub Profile](https://github.com/mohanraj9342)

---

## 📃 License

This project is for educational and demonstration purposes.

---

## 💡 Acknowledgements

- [Streamlit](https://streamlit.io/)
- [Pillow](https://python-pillow.org/)
- [cryptography](https://cryptography.io/)

---