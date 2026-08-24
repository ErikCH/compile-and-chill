import {
  assertSecureControlBinding,
  getConfiguredBindHost,
} from '../utils/control-security'

export default defineNitroPlugin(() => {
  assertSecureControlBinding(
    getConfiguredBindHost(),
    process.env.NUXT_CONTROL_TOKEN,
  )
})
