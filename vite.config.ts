import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const rootDir = import.meta.dirname;
  const appletConfigPath = path.resolve(rootDir, 'firebase-applet-config.json');
  const appletConfig = fs.existsSync(appletConfigPath)
    ? (JSON.parse(fs.readFileSync(appletConfigPath, 'utf-8')) as Record<string, string>)
    : {};

  const pickFirebaseEnv = (
    envVal: string | undefined,
    appletVal: string | undefined,
    invalidPlaceholder: string
  ): string => {
    const trimmed = envVal?.trim();
    if (trimmed && trimmed !== invalidPlaceholder) {
      return trimmed;
    }
    return appletVal || '';
  };

  const firebaseEnv = {
    NEXT_PUBLIC_FIREBASE_API_KEY: pickFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      appletConfig.apiKey,
      'apiKey'
    ),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: pickFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      appletConfig.authDomain,
      'authDomain'
    ),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: pickFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appletConfig.projectId,
      'projectId'
    ),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: pickFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      appletConfig.storageBucket,
      'storageBucket'
    ),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: pickFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appletConfig.messagingSenderId,
      'messagingSenderId'
    ),
    NEXT_PUBLIC_FIREBASE_APP_ID: pickFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      appletConfig.appId,
      'appId'
    ),
    NEXT_PUBLIC_FIREBASE_DATABASE_ID: pickFirebaseEnv(
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID,
      appletConfig.firestoreDatabaseId,
      'firestoreDatabaseId'
    ),
  };

  return {
    define: {
      'process.env.NEXT_PUBLIC_FIREBASE_API_KEY': JSON.stringify(
        firebaseEnv.NEXT_PUBLIC_FIREBASE_API_KEY
      ),
      'process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        firebaseEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      ),
      'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(
        firebaseEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ),
      'process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        firebaseEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      ),
      'process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        firebaseEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
      ),
      'process.env.NEXT_PUBLIC_FIREBASE_APP_ID': JSON.stringify(
        firebaseEnv.NEXT_PUBLIC_FIREBASE_APP_ID
      ),
      'process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID': JSON.stringify(
        firebaseEnv.NEXT_PUBLIC_FIREBASE_DATABASE_ID
      ),
    },
    plugins: [
      {
        name: 'inject-next-public-firebase-env',
        enforce: 'pre',
        transform(code: string, id: string) {
          if (
            !id.includes('node_modules') &&
            code.includes('process.env.NEXT_PUBLIC_FIREBASE_')
          ) {
            return code
              .replaceAll(
                'process.env.NEXT_PUBLIC_FIREBASE_API_KEY',
                JSON.stringify(firebaseEnv.NEXT_PUBLIC_FIREBASE_API_KEY)
              )
              .replaceAll(
                'process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
                JSON.stringify(firebaseEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
              )
              .replaceAll(
                'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID',
                JSON.stringify(firebaseEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
              )
              .replaceAll(
                'process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
                JSON.stringify(firebaseEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
              )
              .replaceAll(
                'process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
                JSON.stringify(firebaseEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)
              )
              .replaceAll(
                'process.env.NEXT_PUBLIC_FIREBASE_APP_ID',
                JSON.stringify(firebaseEnv.NEXT_PUBLIC_FIREBASE_APP_ID)
              )
              .replaceAll(
                'process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID',
                JSON.stringify(firebaseEnv.NEXT_PUBLIC_FIREBASE_DATABASE_ID)
              );
          }
          return undefined;
        },
      },
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
