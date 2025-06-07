import streamlit as st
from PIL import Image
import io
from cryptography.fernet import Fernet
import base64
import hashlib

# -----------------------
# Utils for LSB Algorithm
# -----------------------

def text_to_binary(message):
    """Convert text to binary string."""
    return ''.join(format(ord(c), '08b') for c in message)

def binary_to_text(binary):
    """Convert binary string to text."""
    chars = [binary[i:i+8] for i in range(0, len(binary), 8)]
    return ''.join([chr(int(c, 2)) for c in chars])

def encode_lsb(image, message, progress_callback=None):
    """Encode binary message into image using LSB, with optional progress callback."""
    binary = text_to_binary(message) + '1111111111111110'  # EOF marker
    img = image.convert('RGB')
    pixels = img.load()
    idx = 0
    total = img.width * img.height

    for y in range(img.height):
        for x in range(img.width):
            if idx >= len(binary):
                break

            r, g, b = pixels[x, y]

            if idx < len(binary):
                r = (r & ~1) | int(binary[idx])
                idx += 1
            if idx < len(binary):
                g = (g & ~1) | int(binary[idx])
                idx += 1
            if idx < len(binary):
                b = (b & ~1) | int(binary[idx])
                idx += 1

            pixels[x, y] = (r, g, b)

        # Update progress bar
        if progress_callback:
            progress_callback((y + 1) / img.height)

        if idx >= len(binary):
            break

    return img

def decode_lsb(image):
    """Decode hidden binary message from image using LSB."""
    img = image.convert('RGB')
    pixels = img.load()
    binary = ''

    for y in range(img.height):
        for x in range(img.width):
            r, g, b = pixels[x, y]
            binary += str(r & 1)
            binary += str(g & 1)
            binary += str(b & 1)

    all_bytes = [binary[i:i+8] for i in range(0, len(binary), 8)]
    decoded_text = ''
    for byte in all_bytes:
        if byte == '11111110':  # EOF marker
            break
        decoded_text += chr(int(byte, 2))
    return decoded_text

def generate_key(password):
    """Generate a Fernet key from the password."""
    # Use SHA-256 to hash the password and base64-encode it for Fernet
    return base64.urlsafe_b64encode(hashlib.sha256(password.encode()).digest())

def encrypt_message(message, password):
    key = generate_key(password)
    f = Fernet(key)
    return f.encrypt(message.encode()).decode()  # Return as string for embedding

def decrypt_message(token, password):
    key = generate_key(password)
    f = Fernet(key)
    return f.decrypt(token.encode()).decode()

# ---------------------
# Streamlit Web App UI
# ---------------------

st.set_page_config(page_title="LSB Steganography", page_icon="🛡️")
st.title("🛡️ LSB Steganography Web App")
st.subheader("🔐 Hide or Reveal Secret Text in Images")

mode = st.radio("Choose Mode", ["Encode", "Decode"])

if mode == "Encode":
    uploaded_img = st.file_uploader("Upload Cover Image (PNG/JPG)", type=["png", "jpg", "jpeg"])
    secret_text = st.text_area("Enter Secret Message")

    # Optional encryption
    use_password = st.checkbox("Encrypt message with password (optional)")
    password = ""
    if use_password:
        password = st.text_input("Enter password", type="password")

    if uploaded_img:
        img = Image.open(uploaded_img)
        max_bytes = img.width * img.height * 3 // 8
        st.info(f"Maximum message length for this image: {max_bytes - 2} characters.")
        st.image(uploaded_img, caption="Original Image", use_container_width=True)

    # Place the button directly after the text area
    encode_clicked = st.button("🔐 Encode Message")

    if uploaded_img and secret_text and encode_clicked:
        img = Image.open(uploaded_img)
        max_bytes = img.width * img.height * 3 // 8

        # Encrypt if needed
        msg_to_hide = secret_text
        if use_password and password:
            try:
                msg_to_hide = encrypt_message(secret_text, password)
            except Exception as e:
                st.error(f"Encryption failed: {e}")
                st.stop()

        if len(msg_to_hide) + 2 > max_bytes:
            st.error("Message too long for this image. Please use a shorter message or a larger image.")
        else:
            progress_bar = st.progress(0)
            def update_progress(val):
                progress_bar.progress(val)
            result_img = encode_lsb(img, msg_to_hide, progress_callback=update_progress)
            progress_bar.empty()
            img_byte_arr = io.BytesIO()
            result_img.save(img_byte_arr, format='PNG')
            st.success("✅ Message hidden inside image successfully!")
            st.image(result_img, caption="Stego Image", use_container_width=True)
            st.download_button("⬇️ Download Stego Image", img_byte_arr.getvalue(), file_name="stego_image.png", mime="image/png")

elif mode == "Decode":
    stego_img = st.file_uploader("Upload Stego Image (with hidden message)", type=["png", "jpg", "jpeg"])
    
    # Optional decryption
    use_password = st.checkbox("Message is encrypted with password")
    password = ""
    if use_password:
        password = st.text_input("Enter password to decrypt", type="password")

    if stego_img:
        st.image(stego_img, caption="Stego Image", use_container_width=True)
        if st.button("🔍 Reveal Message"):
            try:
                img = Image.open(stego_img)
                message = decode_lsb(img)
                if message:
                    # Decrypt if needed
                    if use_password and password:
                        try:
                            message = decrypt_message(message, password)
                        except Exception as e:
                            st.error(f"Decryption failed: {e}")
                            st.stop()
                    st.success("✅ Hidden message extracted:")
                    st.code(message)
                    st.download_button("⬇️ Download Message", message, file_name="hidden_message.txt")
                else:
                    st.warning("No hidden message found in this image.")
            except Exception as e:
                st.error(f"Decoding failed: {e}")

if st.button("🔄 Reset"):
    st.session_state.clear()
    if hasattr(st, "rerun"):
        st.rerun()
    else:
        st.experimental_rerun()

st.info("ℹ️ Note: LSB steganography only hides data, it does not encrypt it. For sensitive information, use encryption before hiding.")

# ---------------------
# Sidebar Author Info & About Section
# ---------------------

st.sidebar.markdown("---")
st.sidebar.markdown("**About**")
st.sidebar.info(
    "1. This web app allows you to hide (encode) and reveal (decode) secret messages in images using LSB steganography.\n"
    "2. Optionally, you can encrypt your message with a password for extra security.\n"
    "3. Built with Streamlit and Python."
)
st.sidebar.markdown("**Author:** Mohanraj Velayutham")
st.sidebar.markdown("[GitHub](https://github.com/mohanraj9342)")

# Force dark mode for the whole app
st.markdown(
    """
    <style>
    body { background-color: #222 !important; color: #fff !important; }
    .stApp { background-color: #222 !important; color: #fff !important; }
    .css-1d391kg, .css-1v0mbdj, .css-1cpxqw2, .css-ffhzg2 { background-color: #222 !important; color: #fff !important; }
    </style>
    """,
    unsafe_allow_html=True
)
