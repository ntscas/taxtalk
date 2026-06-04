/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Post, Comment, UserProfile, AuthUser } from './types';

// Environment variables checks
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = 
  supabaseUrl.trim() !== '' && 
  supabaseAnonKey.trim() !== '' && 
  !supabaseUrl.includes('YOUR_SUPABASE') &&
  !supabaseAnonKey.includes('YOUR_SUPABASE');

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

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

export const dbService = {
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
    if (isSupabaseConfigured && supabase) {
      try {
        // Step 1: Sign up in Supabase
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            }
          }
        });
        if (error) throw error;
        if (!data.user) throw new Error('회원가입에 실패했습니다.');

        const userId = data.user.id;

        // Step 2: Insert into public.tax_profiles
        // Standard user flows create this, but let's upsert manually to ensure success
        const { error: profileError } = await supabase
          .from('tax_profiles')
          .upsert({
            id: userId,
            name: name,
            bio: bio,
            avatar_url: avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          console.warn('프로필 자동 생성 실패(SQL 트리거 미설정 등):', profileError.message);
        }

        const authUser: AuthUser = { id: userId, email, name };
        this.notifyAuthChange(authUser);
        return { success: true, user: authUser };
      } catch (err: any) {
        // Fallback to local on DB structure / service error if they configured wrong DB
        console.error('Supabase SignUp Error:', err);
        return { success: false, error: err.message || '회원가입 중 오류가 발생했습니다.' };
      }
    } else {
      // Local Database Flow
      const db = getLocalDB();
      // Check duplicate
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        if (!data.user) throw new Error('로그인에 실패했습니다.');

        // Get metadata name or active profile
        let name = data.user.user_metadata?.full_name || email.split('@')[0];
        
        // Let's try to query profile name
        try {
          const { data: profile } = await supabase
            .from('tax_profiles')
            .select('name')
            .eq('id', data.user.id)
            .single();
          if (profile && profile.name) {
            name = profile.name;
          }
        } catch (_) {}

        const authUser: AuthUser = { id: data.user.id, email, name };
        this.notifyAuthChange(authUser);
        return { success: true, user: authUser };
      } catch (err: any) {
        console.error('Supabase Login Error:', err);
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
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      const db = getLocalDB();
      db.currentUser = null;
      saveLocalDB(db);
    }
    this.notifyAuthChange(null);
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        let name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
        try {
          const { data: p } = await supabase.from('tax_profiles').select('name').eq('id', user.id).single();
          if (p?.name) name = p.name;
        } catch (_) {}

        return { id: user.id, email: user.email || '', name };
      } catch (e) {
        return null;
      }
    } else {
      return getLocalDB().currentUser;
    }
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('tax_profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error) {
          // If profile doesn't exist, create default
          if (error.code === 'PGRST116') {
            const defaultProfile: UserProfile = {
              id: userId,
              name: '사용자',
              bio: '',
              avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`,
              updated_at: new Date().toISOString()
            };
            return defaultProfile;
          }
          throw error;
        }
        return data as UserProfile;
      } catch (err) {
        console.error('Error fetching profile from Supabase:', err);
        return null;
      }
    } else {
      const db = getLocalDB();
      return db.profiles[userId] || null;
    }
  },

  async updateProfile(userId: string, profileData: Partial<UserProfile>) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('tax_profiles')
          .upsert({
            id: userId,
            ...profileData,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Error updating profile in Supabase:', err);
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
    if (isSupabaseConfigured && supabase) {
      try {
        // Query posts table and map profile info or do inner join if supported
        // But to make it secure and resilient, we query and map profiles manually or do a join
        const { data, error } = await supabase
          .from('tax_posts')
          .select(`
            id,
            title,
            content,
            author_id,
            created_at,
            views,
            profiles:tax_profiles(name, avatar_url)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((item: any) => {
          const profile = item.profiles || item.tax_profiles;
          return {
            id: item.id,
            title: item.title,
            content: item.content,
            author_id: item.author_id,
            author_name: (Array.isArray(profile) ? profile[0]?.name : profile?.name) || '알 수 없음',
            author_avatar: (Array.isArray(profile) ? profile[0]?.avatar_url : profile?.avatar_url) || '',
            created_at: item.created_at,
            views: item.views || 0
          };
        });
      } catch (err) {
        console.error('Error fetching posts from Supabase:', err);
        // Fall back to local posts to avoid blank screens if table not ready
        return getLocalDB().posts;
      }
    } else {
      return [...getLocalDB().posts].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async incrementViews(postId: string) {
    if (isSupabaseConfigured && supabase) {
      try {
        // Increment view count in Supabase
        // Utilizing supabase rpc or simple update (though update is less race-safe, it works without custom functions)
        const { data: post } = await supabase.from('tax_posts').select('views').eq('id', postId).single();
        if (post) {
          await supabase.from('tax_posts').update({ views: (post.views || 0) + 1 }).eq('id', postId);
        }
      } catch (e) {
        console.warn('Could not increment views in Supabase:', e);
      }
    } else {
      const db = getLocalDB();
      db.posts = db.posts.map(p => p.id === postId ? { ...p, views: p.views + 1 } : p);
      saveLocalDB(db);
    }
  },

  async createPost(title: string, content: string, userId: string): Promise<{ success: boolean; data?: Post; error?: string }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('tax_posts')
          .insert({
            title,
            content,
            author_id: userId,
            created_at: new Date().toISOString(),
            views: 0
          })
          .select()
          .single();

        if (error) throw error;

        // Fetch author profiles
        const profile = await this.getProfile(userId);
        const newPost: Post = {
          id: data.id,
          title: data.title,
          content: data.content,
          author_id: data.author_id,
          author_name: profile?.name || '알 수 없음',
          author_avatar: profile?.avatar_url || '',
          created_at: data.created_at,
          views: 0
        };

        return { success: true, data: newPost };
      } catch (err: any) {
        console.error('Error creating post in Supabase:', err);
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('tax_posts')
          .update({ title, content })
          .eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Error updating post in Supabase:', err);
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('tax_posts')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Error deleting post in Supabase:', err);
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('tax_comments')
          .select(`
            id,
            post_id,
            author_id,
            content,
            created_at,
            profiles:tax_profiles(name, avatar_url)
          `)
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        return (data || []).map((item: any) => {
          const profile = item.profiles || item.tax_profiles;
          return {
            id: item.id,
            post_id: item.post_id,
            author_id: item.author_id,
            author_name: (Array.isArray(profile) ? profile[0]?.name : profile?.name) || '알 수 없음',
            author_avatar: (Array.isArray(profile) ? profile[0]?.avatar_url : profile?.avatar_url) || '',
            content: item.content,
            created_at: item.created_at
          };
        });
      } catch (err) {
        console.error('Error fetching comments from Supabase:', err);
        return getLocalDB().comments.filter(c => c.post_id === postId);
      }
    } else {
      return getLocalDB().comments
        .filter(c => c.post_id === postId)
        .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
  },

  async createComment(postId: string, content: string, userId: string): Promise<{ success: boolean; data?: Comment; error?: string }> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('tax_comments')
          .insert({
            post_id: postId,
            content,
            author_id: userId,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;

        const profile = await this.getProfile(userId);
        const newComment: Comment = {
          id: data.id,
          post_id: data.post_id,
          author_id: data.author_id,
          author_name: profile?.name || '알 수 없음',
          author_avatar: profile?.avatar_url || '',
          content: data.content,
          created_at: data.created_at
        };

        return { success: true, data: newComment };
      } catch (err: any) {
        console.error('Error creating comment in Supabase:', err);
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('tax_comments')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        console.error('Error deleting comment in Supabase:', err);
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
