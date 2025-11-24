# Cloudinary Environment Setup

Cloudinary is used to host doctor profile photos uploaded from the admin panel. Create an `.env` file inside the `api/` directory (next to `server.js`) with the following variables:

```
CLOUDINARY_URL=cloudinary://727291567666842:OVIJpu_bzw5vHI23_62dm4J3qv0@dv5kklucp
CLOUDINARY_API_KEY=727291567666842
CLOUDINARY_API_SECRET=OVIJpu_bzw5vHI23_62dm4J3qv0
```

> **Note:** These values were supplied by the stakeholder. Keep them private and rotate if they leak.

After updating the `.env`, restart the API server so the new credentials are loaded.

