import { createVaporApp } from 'vue'
import App from './App.vue'
import '../../src/ui/base.css'

document.documentElement.lang = browser.i18n.getUILanguage()
createVaporApp(App).mount('#app')
