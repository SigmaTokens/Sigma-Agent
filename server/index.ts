import express from 'express'
import cors from 'cors'
import { Globals } from './globals'
import { isAdmin } from './utilities/auth'
import { Constants } from './constants'
import { isWindows, windows_enable_auditing, isMac } from './utilities/host'

main()

function main(): void {
  const app = express()
  app.use(express.json())

  app.use(cors())
  app.use(express.urlencoded({ extended: true }))
  const port = process.env.PORT || 9007

  isAdmin().then((isAdmin) => {
    if (!isAdmin) {
      console.error(Constants.TEXT_RED_COLOR, 'Please run as administrator')
      return
    }
    init()
      .then(() => {
        Globals.app = app

        app.listen(port, () => {
          console.log(`[+] Server running on port ${port}`)
        })
      })
      .catch((error) => {
        console.error('[-] Failed to initialize server:', error)
        process.exit(1)
      })
  })
}

async function init() {
  if (isWindows()) {
    await windows_enable_auditing()
  } else if (isMac()) {
    console.log('Running on Mac')
  }
}
