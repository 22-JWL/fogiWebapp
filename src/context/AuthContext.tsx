import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { User, UserRole, Part } from '../types'

interface AuthContextType {
  currentUser: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string, part: Part, birthday: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)

      // 오프라인·규칙 오류로 getDoc이 실패해도 로딩은 반드시 끝내야 한다
      // (안 그러면 PWA가 '로딩 중...' 스피너에서 영구 정지한다)
      try {
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          setCurrentUser(userDoc.exists() ? ({ id: user.uid, ...userDoc.data() } as User) : null)
        } else {
          setCurrentUser(null)
        }
      } catch (error) {
        console.error('사용자 정보 로드 실패:', error)
        setCurrentUser(null)
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, name: string, part: Part, birthday: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    // 첫 번째 사용자는 manager, 나머지는 member
    const role: UserRole = 'member' // 기본값, 나중에 매니저가 변경 가능

    const userData: Omit<User, 'id'> = {
      name,
      email,
      role,
      part,
      birthday,
      createdAt: new Date().toISOString()
    }

    await setDoc(doc(db, 'users', user.uid), userData)
    setCurrentUser({ id: user.uid, ...userData })
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setCurrentUser(null)
  }

  const value: AuthContextType = {
    currentUser,
    firebaseUser,
    loading,
    signIn,
    signUp,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
