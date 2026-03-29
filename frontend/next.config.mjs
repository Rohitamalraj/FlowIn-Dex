import path from "node:path"
import { fileURLToPath } from "node:url"

/** @type {import('next').NextConfig} */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { webpack }) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": path.resolve(__dirname, "lib/shims/async-storage.ts"),
    }

    // @wagmi/connectors exports every connector in one barrel file,
    // including ones that need optional peer deps (Safe, Porto, Base, MetaMask SDK...).
    // Next.js webpack tries to resolve all of them even when unused.
    // This plugin ignores any module that (a) is imported FROM @wagmi/connectors or @metamask/sdk
    // and (b) cannot be resolved — future-proof, no manual list needed.
    config.plugins.push(
      new webpack.IgnorePlugin({
        checkResource(resource, context) {
          if (!context) return false

          const fromWagmiConnectors = context.includes("@wagmi/connectors")
          const fromMetaMaskSdk = context.includes("@metamask/sdk")
          if (!fromWagmiConnectors && !fromMetaMaskSdk) {
            return false
          }

          try {
            require.resolve(resource, { paths: [context] })
            return false // module exists, don't ignore
          } catch {
            return true  // module missing, ignore it
          }
        },
      })
    )
    return config
  },
}

export default nextConfig





