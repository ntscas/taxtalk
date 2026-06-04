/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Post, Comment, UserProfile, AuthUser } from './types';

function cleanEnvValue(val: string | undefined): string {
  if (!val) return '';
  let cleaned = val.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned.trim();
}

function cleanSupabaseUrl(url: string): string {
  if (!url) return '';
  const cleaned = cleanEnvValue(url);
  // If the user entered the browser dashboard URL by mistake
  if (cleaned.includes('supabase.com/dashboard/project/')) {
    const parts = cleaned.split('supabase.com/dashboard/project/');
    if (parts.length > 1) {
      const ref = parts[1].split('/')[0].trim();
      if (ref) return `https://${ref}.supabase.co`;
    }
  }
  return cleaned;
}

// Environment variables checks to determine if we should use Cloud DB or Local fallback
const supabaseUrlRaw = (import.meta as any).env.VITE_SUPABASE_URL || '';
export const supabaseUrl = cleanSupabaseUrl(supabaseUrlRaw);
const supabaseAnonKey = cleanEnvValue((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '');

export let isSupabaseConfigured = 
  supabaseUrl.trim() !== '' && 
  supabaseAnonKey.trim() !== '' && 
  !supabaseUrl.includes('YOUR_SUPABASE') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE');

let configCheckPromise: Promise<boolean> | null = null;

// Export dummy supabase for compatibility if needed, though direct client calls are bypassed
export const supabase = null;

// Helper to manage LocalStorage database fallback
const LOCAL_STORAGE_KEY = 'supabase_board_fallback_db';

interface LocalDB {
  users: Record<string, { email: string; name: string; passwordHash: string }>;
  profiles: Record<string, UserProfile>;
  posts: Post[];
  comments: Comment[];
  currentUser: AuthUser | null;
}

const initialLocalDB: LocalDB = {
  users: {
    'demo-user-id': {
      email: 'demo@example.com',
      name: '김테스트',
      passwordHash: 'demo123'
    }
  },
  profiles: {
    'demo-user-id': {
      id: 'demo-user-id',
      name: '김테스트',
      bio: '안녕하세요! 이 게시판의 첫 번째 데모 사용자입니다. Supabase를 연동하여 실시간 데이터베이스를 구축해보세요.',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      updated_at: new Date().toISOString()
    }
  },
  posts: [
    {
      id: 'demo-post-1',
      title: 'Supabase 연동 게시판에 오신 것을 환영합니다!',
      content: '이 게시판은 Supabase 와 연동되어 동작하도록 개발되었습니다.\n\n현재는 안전한 오프라인 LocalStorage 데모 모드로 작동 중입니다. .env.example 파일을 참고하여 VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY 환경 변수를 등록하시면 즉시 실제 Supabase의 실시간 클라우드 DB와 연동됩니다.\n\n프로필 페이지에서 나만의 아바타, 자기소개 및 이름을 변경하고 글을 작성해 보세요!',
      author_id: 'demo-user-id',
      author_name: '김테스트',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
      views: 42
    },
    {
      id: 'demo-post-2',
      title: 'Supabase 테이블 설정을 위한 SQL 쿼리 가이드 (꿀팁)',
      content: '실제 Supabase를 사용하실 때 대시보드의 SQL Editor에 실행할 쿼리문입니다.\n\n화면 상단의 [DB 연동 가이드] 버튼을 누르시면 필요한 전체 SQL 스크립트를 즉시 복사하여 편리하게 데이터베이스를 구축하실 수 있습니다.',
      author_id: 'demo-user-id',
      author_name: '김테스트',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      views: 9
    }
  ],
  comments: [
    {
      id: 'demo-comment-1',
      post_id: 'demo-post-1',
      author_id: 'demo-user-id',
      author_name: '김테스트',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      content: '너무 깔끔하고 예쁜 게시판이네요! 🚀',
      created_at: new Date(Date.now() - 1800000).toISOString()
    }
  ],
  currentUser: null
};

function getLocalDB(): LocalDB {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialLocalDB));
    return initialLocalDB;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return initialLocalDB;
  }
}

function saveLocalDB(db: LocalDB) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
}

// Global active auth listener
let authListeners: ((user: AuthUser | null) => void)[] = [];

// Clean, lightweight HTTP client for Server-Side proxy communication
async function apiFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('supabase_access_token');
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.error) {
        errorMessage = errData.error;
      }
    } catch (_) {}

    if (response.status === 401 || response.status === 403 || errorMessage === 'Unauthorized user action') {
      localStorage.removeItem('supabase_access_token');
      // Force all subscription listeners to flush user state to null
      authListeners.forEach(listener => listener(null));
      throw new Error('로그인 세션이 만료되거나 인증에 실패했습니다. 다시 로그인하거나 회원가입을 완료해 주세요.');
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const dbService = {
  async checkConfig(): Promise<boolean> {
    if (configCheckPromise) {
      return configCheckPromise;
    }
    configCheckPromise = (async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          isSupabaseConfigured = !!data.isSupabaseConfigured;
          console.log('Runtime Supabase config sync from server:', isSupabaseConfigured);
          return isSupabaseConfigured;
        }
      } catch (e) {
        console.warn('Could not fetch server config, using build-time fallback:', e);
      }
      return isSupabaseConfigured;
    })();
    return configCheckPromise;
  },

  subscribeAuth(callback: (user: AuthUser | null) => void) {
    authListeners.push(callback);
    // Initial fetch
    this.getCurrentUser().then(callback);
    
    // Return unsubscribe function
    return () => {
      authListeners = authListeners.filter(l => l !== callback);
    };
  },

  notifyAuthChange(user: AuthUser | null) {
    authListeners.forEach(l => l(user));
  },

  async signUp(email: string, password: string, name: string, bio: string = '', avatarUrl: string = '') {
    await this.checkConfig();
    if (isSupabaseConfigured) {
      try {
        const responseData = await apiFetch('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, name, bio, avatarUrl })
        });

        if (responseData.session && responseData.session.access_token) {
          localStorage.setItem('supabase_access_token', responseData.session.access_token);
        }

        const authUser: AuthUser = responseData.user;
        this.notifyAuthChange(authUser);
        return { success: true, user: authUser };
      } catch (err: any) {
        console.error('Proxy Client SignUp Error:', err);
        return { success: false, error: err.message || '회원가입 중 오류가 발생했습니다.' };
      }
    } else {
      // Local Database Flow
      const db = getLocalDB();
      const exists = Object.values(db.users).some(u => u.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        return { success: false, error: '이미 사용중인 이메일입니다.' };
      }

      const generatedId = 'user_' + Math.random().toString(36).substr(2, 9);
      db.users[generatedId] = { email, name, passwordHash: password };
      
      const newProfile: UserProfile = {
        id: generatedId,
        name,
        bio,
        avatar_url: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
        updated_at: new Date().toISOString()
      };
      
      db.profiles[generatedId] = newProfile;
      db.currentUser = { id: generatedId, email, name };
      saveLocalDB(db);
      
      this.notifyAuthChange(db.currentUser);
      return { success: true, user: db.currentUser };
    }
  },

  async signIn(email: string, password: string) {
    await this.checkConfig();
    if (isSupabaseConfigured) {
      try {
        const responseData = await apiFetch('/api/auth/signin', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        if (responseData.session && responseData.session.access_token) {
          localStorage.setItem('supabase_access_token', responseData.session.access_token);
        }

        const authUser: AuthUser = responseData.user;
        this.notifyAuthChange(authUser);
        return { success: true, user: authUser };
      } catch (err: any) {
        console.error('Proxy Client Login Error:', err);
        return { success: false, error: err.message || '이메일 또는 비밀번호가 올바르지 않습니다.' };
      }
    } else {
      // Local Database Flow
      const db = getLocalDB();
      const matchedUserId = Object.keys(db.users).find(
        uid => db.users[uid].email.toLowerCase() === email.toLowerCase() && db.users[uid].passwordHash === password
      );

      if (!matchedUserId) {
        return { success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다.' };
      }

      const userRecord = db.users[matchedUserId];
      db.currentUser = { id: matchedUserId, email: userRecord.email, name: userRecord.name };
      saveLocalDB(db);
      
      this.notifyAuthChange(db.currentUser);
      return { success: true, user: db.currentUser };
    }
  },

  async signOut() {
    if (isSupabaseConfigured) {
      try {
        localStorage.removeItem('supabase_access_token');
      } catch (e) {
        console.warn('Error clearing token:', e);
      }
    } else {
      const db = getLocalDB();
      db.currentUser = null;
      saveLocalDB(db);
    }
    this.notifyAuthChange(null);
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    await this.checkConfig();
    if (isSupabaseConfigured) {
      const token = localStorage.getItem('supabase_access_token');
      if (!token) return null;

      try {
        const user = await apiFetch('/api/auth/me');
        return user;
      } catch (e) {
        // Token has expired or is invalid
        localStorage.removeItem('supabase_access_token');
        return null;
      }
    } else {
      return getLocalDB().currentUser;
    }
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      try {
        const data = await apiFetch(`/api/profiles/${userId}`);
        return data as UserProfile;
      } catch (err) {
        console.error('Proxy Client fetch profile error:', err);
        return null;
      }
    } else {
      const db = getLocalDB();
      return db.profiles[userId] || null;
    }
  },

  async updateProfile(userId: string, profileData: Partial<UserProfile>) {
    if (isSupabaseConfigured) {
      try {
        await apiFetch(`/api/profiles/${userId}`, {
          method: 'PUT',
          body: JSON.stringify(profileData)
        });
        return { success: true };
      } catch (err: any) {
        console.error('Proxy Client update profile error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      const existing = db.profiles[userId] || {
        id: userId,
        name: '사용자',
        bio: '',
        avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`,
        updated_at: ''
      };
      
      const updated = {
        ...existing,
        ...profileData,
        updated_at: new Date().toISOString()
      };
      
      db.profiles[userId] = updated;
      
      // Update name in currentUser record if active user is editing their own
      if (db.currentUser && db.currentUser.id === userId) {
        db.currentUser.name = updated.name;
        db.users[userId].name = updated.name;
      }
      
      // Sync names on posts written by this user
      db.posts = db.posts.map(p => {
        if (p.author_id === userId) {
          return { ...p, author_name: updated.name, author_avatar: updated.avatar_url };
        }
        return p;
      });

      // Sync names on comments
      db.comments = db.comments.map(c => {
        if (c.author_id === userId) {
          return { ...c, author_name: updated.name, author_avatar: updated.avatar_url };
        }
        return c;
      });

      saveLocalDB(db);
      this.notifyAuthChange(db.currentUser);
      return { success: true };
    }
  },

  async getPosts(): Promise<Post[]> {
    await this.checkConfig();
    if (isSupabaseConfigured) {
      try {
        const posts = await apiFetch('/api/posts');
        return posts;
      } catch (err) {
        console.error('Proxy Client fetch posts error:', err);
        return getLocalDB().posts;
      }
    } else {
      return [...getLocalDB().posts].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async incrementViews(postId: string) {
    if (isSupabaseConfigured) {
      try {
        await apiFetch(`/api/posts/${postId}/view`, {
          method: 'POST'
        });
      } catch (e) {
        console.warn('Proxy Client increment views warning:', e);
      }
    } else {
      const db = getLocalDB();
      db.posts = db.posts.map(p => p.id === postId ? { ...p, views: p.views + 1 } : p);
      saveLocalDB(db);
    }
  },

  async createPost(title: string, content: string, userId: string): Promise<{ success: boolean; data?: Post; error?: string }> {
    if (isSupabaseConfigured) {
      try {
        const responseData = await apiFetch('/api/posts', {
          method: 'POST',
          body: JSON.stringify({ title, content, userId })
        });
        return { success: true, data: responseData.data };
      } catch (err: any) {
        console.error('Proxy Client create post error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      const profile = db.profiles[userId];
      
      const newPost: Post = {
        id: 'post_' + Math.random().toString(36).substr(2, 9),
        title,
        content,
        author_id: userId,
        author_name: profile?.name || '알 수 없음',
        author_avatar: profile?.avatar_url || '',
        created_at: new Date().toISOString(),
        views: 0
      };
      
      db.posts.push(newPost);
      saveLocalDB(db);
      return { success: true, data: newPost };
    }
  },

  async updatePost(id: string, title: string, content: string) {
    if (isSupabaseConfigured) {
      try {
        await apiFetch(`/api/posts/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, content })
        });
        return { success: true };
      } catch (err: any) {
        console.error('Proxy Client update post error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      db.posts = db.posts.map(p => p.id === id ? { ...p, title, content } : p);
      saveLocalDB(db);
      return { success: true };
    }
  },

  async deletePost(id: string) {
    if (isSupabaseConfigured) {
      try {
        await apiFetch(`/api/posts/${id}`, {
          method: 'DELETE'
        });
        return { success: true };
      } catch (err: any) {
        console.error('Proxy Client delete post error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      db.posts = db.posts.filter(p => p.id !== id);
      db.comments = db.comments.filter(c => c.post_id !== id);
      saveLocalDB(db);
      return { success: true };
    }
  },

  async getComments(postId: string): Promise<Comment[]> {
    if (isSupabaseConfigured) {
      try {
        const comments = await apiFetch(`/api/posts/${postId}/comments`);
        return comments;
      } catch (err) {
        console.error('Proxy Client fetch comments error:', err);
        return getLocalDB().comments.filter(c => c.post_id === postId);
      }
    } else {
      return getLocalDB().comments
        .filter(c => c.post_id === postId)
        .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
  },

  async createComment(postId: string, content: string, userId: string): Promise<{ success: boolean; data?: Comment; error?: string }> {
    if (isSupabaseConfigured) {
      try {
        const responseData = await apiFetch(`/api/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ content, userId })
        });
        return { success: true, data: responseData.data };
      } catch (err: any) {
        console.error('Proxy Client create comment error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      const profile = db.profiles[userId];

      const newComment: Comment = {
        id: 'comment_' + Math.random().toString(36).substr(2, 9),
        post_id: postId,
        author_id: userId,
        author_name: profile?.name || '알 수 없음',
        author_avatar: profile?.avatar_url || '',
        content,
        created_at: new Date().toISOString()
      };

      db.comments.push(newComment);
      saveLocalDB(db);
      return { success: true, data: newComment };
    }
  },

  async deleteComment(id: string) {
    if (isSupabaseConfigured) {
      try {
        await apiFetch(`/api/comments/${id}`, {
          method: 'DELETE'
        });
        return { success: true };
      } catch (err: any) {
        console.error('Proxy Client delete comment error:', err);
        return { success: false, error: err.message };
      }
    } else {
      const db = getLocalDB();
      db.comments = db.comments.filter(c => c.id !== id);
      saveLocalDB(db);
      return { success: true };
    }
  }
};
