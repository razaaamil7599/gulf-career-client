// Helper to upload a File/Blob to Cloudinary (unsigned preset)
// Usage example:
// const url = await uploadToCloudinary(file, 'ddisi6e7m', 'GULFCAREER');
export async function uploadToCloudinary(file, cloudName, uploadPreset) {
    if (!file) return null;
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', uploadPreset);
    // optional: fd.append('folder', 'jobs');
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) {
        const text = await res.text();
        throw new Error('Cloudinary upload failed: ' + text);
    }
    const json = await res.json();
    // json.secure_url is the publicly accessible image URL
    return json.secure_url;
}