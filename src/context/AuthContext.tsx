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
import { disableDeviceNotifications } from '../firebase/fcm'
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
    const { user } = await signInWithEmailAndPassword(auth, email, password)
    // 가입이 거절됐거나 users 문서가 없는 계정은 들어갈 수 없다 — 아무 반응 없이 로그인 화면에 머무는 대신 이유를 알려 준다
    if (!(await getDoc(doc(db, 'users', user.uid))).exists()) {
      await firebaseSignOut(auth)
      throw new Error('가입이 거절되었거나 삭제된 계정입니다. 매니저에게 문의해 주세요.')
    }
  }

  const signUp = async (email: string, password: string, name: string, part: Part, birthday: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    // 매니저가 승인하기 전까지는 대기 상태 (firestore.rules 가 'pending' 으로만 생성을 허용한다)
    const role: UserRole = 'pending'

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
    // 로그아웃한 계정의 알림이 이 기기로 계속 오지 않도록 이 기기의 토큰을 지운다.
    // 실패하거나 오래 걸려도 로그아웃을 막지 않는다 (오프라인에서는 Firestore 쓰기가 끝나지 않으므로 3초만 기다린다)
    if (currentUser) {
      await Promise.race([
        disableDeviceNotifications(currentUser.id).catch((error) => console.error('알림 해제 실패:', error)),
        new Promise((resolve) => setTimeout(resolve, 3000))
      ])
    }
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
