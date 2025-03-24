/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable React strict mode for development
    reactStrictMode: true,

    // Configure environment variables to be available in the browser
    // Note: This is not needed for server-side environment variables
    // and should not be used for sensitive values like API keys
    env: {
        // Public environment variables only
        APP_ENV: process.env.NODE_ENV || 'development',
    },

    // Configure image domains if you're using next/image
    images: {
        domains: ['plumbers3.s3.eu-north-1.amazonaws.com', 'lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
    },

    // Configure headers if needed
    async headers() {
        return [
            {
                // Apply these headers to all routes
                source: '/:path*',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors 'self' *",
                    },
                ],
            },
        ];
    },

    // Disable server-side image optimization if you're using S3 or other CDNs
    // images: {
    //   unoptimized: true,
    // },

    // Configure webpack if needed
    webpack: (config, { isServer }) => {
        // Custom webpack config if needed
        return config;
    },
};

module.exports = nextConfig;