import { API_BASE } from './api.js'
import { toast, toastError, confirmToast } from './toast.js'

function escapeHTML(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;')
           .replace(/'/g, '&#39;')
}

async function loadPendingUsers() {
  const table = document.getElementById('pendingTable')
  const tbody = document.getElementById('pendingBody')
  console.log('Sprawdzam DOM: pendingTable=', !!table, 'pendingBody=', !!tbody)
  if (!table || !tbody) {
    console.error('Brak elementów DOM: pendingTable=', table, 'pendingBody=', tbody)
    return
  }

  tbody.innerHTML = '<tr><td colspan="5">Ładowanie…</td></tr>'

  try {
    console.log(`Wysyłam fetch: ${API_BASE}/api/admin/pending-users`)
    const res = await fetch(`${API_BASE}/api/admin/pending-users`, {
      credentials: 'include'
    })
    const data = await res.json()
    console.log('Odpowiedź z API:', data)
    if (!res.ok) throw new Error(data?.message || `Błąd ${res.status}`)
    
    renderTable(data.users || [])
  } catch (err) {
    console.error('Błąd ładowania użytkowników:', err)
    tbody.innerHTML = '<tr><td colspan="5" style="color:crimson">Błąd ładowania użytkowników.</td></tr>'
    toastError(err.message || 'Nie udało się wczytać użytkowników.')
  }
}

function renderTable(users) {
  const tbody = document.getElementById('pendingBody')
  if (!tbody) return

  if (!Array.isArray(users) || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Brak użytkowników do wyświetlenia.</td></tr>'
    return
  }

  tbody.innerHTML = users.map(user => {
    // ZMIANA 1: Formatowanie createdAt do rrrr-mm-dd gg:mm
    const createdAt = user.createdAt 
      ? new Date(user.createdAt).toLocaleString('pl-PL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', '').replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$3-$2-$1')
      : '-'
    return `
      <tr data-id="${user._id}">
        <td>${escapeHTML(user.username)}</td>
        <td>${escapeHTML(user.email)}</td>
        <td>${escapeHTML(user.role)}</td>
        <!-- ZMIANA 2: Dodano kolumnę z createdAt -->
        <td>${createdAt}</td>
        <td>
          <button class="btn--sm btn-approve-user">Zatwierdź</button>
          <button class="btn--sm btn--danger btn-reject-user">Odrzuć</button>
        </td>
      </tr>
    `
  }).join('')
}

document.getElementById('pendingTable')?.addEventListener('click', async (e) => {
  const row = e.target.closest('tr[data-id]')
  if (!row) return
  const id = row.dataset.id

  if (e.target.classList.contains('btn-approve-user')) {
    const ok = await confirmToast({
      message: 'Zatwierdzić tego użytkownika?',
      okText: 'Zatwierdź',
      cancelText: 'Anuluj'
    })
    if (!ok) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/approve/${id}`, {
        method: 'POST',
        credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || `Błąd ${res.status}`)
      row.remove()
      toast('Użytkownik zatwierdzony.', 'success')
    } catch (err) {
      toastError(err.message || 'Błąd zatwierdzania użytkownika.')
    }
    return
  }

  if (e.target.classList.contains('btn-reject-user')) {
    const ok = await confirmToast({
      message: 'Odrzucić tego użytkownika?',
      okText: 'Odrzuć',
      cancelText: 'Anuluj'
    })
    if (!ok) return

    try {
      const res = await fetch(`${API_BASE}/api/admin/reject/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || `Błąd ${res.status}`)
      row.remove()
      toast('Użytkownik odrzucony.', 'success')
    } catch (err) {
      toastError(err.message || 'Błąd odrzucania użytkownika.')
    }
  }
})

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded: Sprawdzam DOM...')
  console.log('pendingTable:', document.getElementById('pendingTable'))
  console.log('pendingBody:', document.getElementById('pendingBody'))
  loadPendingUsers()
})