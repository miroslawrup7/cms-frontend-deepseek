// js/register.js v.2
import { API_BASE } from './api.js'
import { toast, toastError } from './toast.js'

document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault()

    const username = document.getElementById("username").value
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value
    const role = document.getElementById("role").value
    const errorEl = document.getElementById("error")
    const successEl = document.getElementById("success")
    const submitBtn = e.target.querySelector('button[type="submit"]')

    // Czyść poprzednie komunikaty
    if (errorEl) errorEl.textContent = ''
    if (successEl) successEl.textContent = ''
    if (submitBtn) submitBtn.disabled = true

    try {
        const res = await fetch(`${API_BASE}/api/auth/register-pending`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, email, password, role })
        })

        const data = await res.json()

        if (!res.ok) {
            // Błąd z backendu
            const errorMsg = data.message || "Błąd rejestracji"
            if (errorEl) errorEl.textContent = errorMsg
            toastError(errorMsg)
            return
        }

        // Sukces
        const successMsg = data.message || "Wniosek rejestracyjny został przesłany do zatwierdzenia."
        if (successEl) successEl.textContent = successMsg
        toast(successMsg, 'success')
        
        // Resetuj formularz
        e.target.reset()

        // NIE PRZEKIEROWUJ AUTOMATYCZNIE - użytkownik zostaje na stronie rejestracji
        // użytkownik może teraz zobaczyć komunikat sukcesu

    } catch (err) {
        const errorMsg = "Błąd połączenia z serwerem"
        if (errorEl) errorEl.textContent = errorMsg
        toastError(errorMsg)
    } finally {
        if (submitBtn) submitBtn.disabled = false
    }
})