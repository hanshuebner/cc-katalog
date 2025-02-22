import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import * as backend from '../api/index'
import { useUser } from '../contexts/userUtils.ts'
import DropdownMenu from './DropdownMenu.tsx'
import SearchTableNumber from './SearchTableNumber.tsx'
import { getBookmarks } from '../utils/bookmarks.ts'

const NavBar = () => {
  const { user } = useUser()
  const [hasBookmarks, setHasBookmarks] = useState(getBookmarks().length > 0)

  const handleLogout = async () => {
    await backend.postAuthLogout()
    window.location.reload()
  }

  useEffect(() => {
    const updateBookmarks = () => {
      setHasBookmarks(getBookmarks().length > 0)
    }

    window.addEventListener('storage', updateBookmarks)
    window.addEventListener('bookmarksUpdated', updateBookmarks)

    return () => {
      window.removeEventListener('storage', updateBookmarks)
      window.removeEventListener('bookmarksUpdated', updateBookmarks)
    }
  }, [])

  return (
    <nav>
      <ul>
        <li>
          <Link to="/">Start</Link>
        </li>
        <li>
          <Link to="/exhibits">Ausstellungen</Link>
        </li>
        <li>
          <Link to="/schedule">Zeitplan</Link>
        </li>
        {user?.isAdministrator && (
          <li>
            <DropdownMenu label="Verwaltung">
              <li>
                <Link to="/admin/registration">Anmeldungen</Link>
              </li>
            </DropdownMenu>
          </li>
        )}
      </ul>
      <ul>
        {user ? (
          <li>
            <DropdownMenu label={`@${user.username}`}>
              <li>
                <Link to="/profile">Profil</Link>
              </li>
              <li>
                <a href="#" onClick={handleLogout}>
                  Logout
                </a>
              </li>
            </DropdownMenu>
          </li>
        ) : (
          <li>
            <a href="/auth/forum">Login</a>
          </li>
        )}
        <li>
          <Link to="/bookmarks">
            <button className="button image-only-button">
              <img
                src={hasBookmarks ? '/bookmarked.svg' : '/bookmark.svg'}
                className="button-image inverted-image"></img>
            </button>
          </Link>
        </li>
        <li>
          <SearchTableNumber />
        </li>
      </ul>
    </nav>
  )
}

export default NavBar
