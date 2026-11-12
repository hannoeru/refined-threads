import { createVaporApp } from 'vue'
import '../../src/ui/base.css'
import App from './App.vue'

document.documentElement.lang = browser.i18n.getUILanguage()
createVaporApp(App).mount('#app')
