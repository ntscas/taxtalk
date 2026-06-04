/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthUser, Post, Category, parseCategoryAndTitle } from './types';
import { dbService, isSupabaseConfigured } from './supabaseClient';
import BoardList from './components/BoardList';
import PostDetail from './components/PostDetail';
import PostForm from './components/PostForm';
import UserProfile from './components/UserProfile';
import AuthScreen from './components/AuthScreen';
import ConfigGuide from './components/ConfigGuide';
import { 
  Cloud, 
  CloudOff, 
  Layers, 
  User, 
  Database, 
  LogOut, 
  LogIn, 
  Sparkles, 
  Rss, 
  Zap,
  BarChart3,
  Bookmark,
  BookOpen,
  Eye,
  Heart,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<'board' | 'profile' | 'guide'>('board');
  const [boardView, setBoardView] = useState<'list' | 'detail' | 'write' | 'edit'>('list');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);
  const [userAvatar, setUserAvatar] = useState<string>('');
  
  // High fidelity states
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'All' | Category>('All');
  const [likesUpdateTrigger, setLikesUpdateTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sychronize authorization state globally
  useEffect(() => {
    const unsubscribe = dbService.subscribeAuth((user) => {
      setCurrentUser(user);
      if (user) {
        dbService.getProfile(user.id).then(profile => {
          if (profile && profile.avatar_url) {
            setUserAvatar(profile.avatar_url);
          } else {
            setUserAvatar('');
          }
        });
      } else {
        setUserAvatar('');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleProfileUpdated = () => {
    if (currentUser) {
      dbService.getProfile(currentUser.id).then(profile => {
        if (profile && profile.avatar_url) {
          setUserAvatar(profile.avatar_url);
        }
      });
    }
  };

  const handleLogout = async () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      await dbService.signOut();
      setActiveTab('board');
      setBoardView('list');
    }
  };

  // Fetch posts globally to compute stats and categories counts
  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const dbPosts = await dbService.getPosts();
      setPosts(dbPosts);
      
      // Auto-select first post on initial load if on desktop and none selected
      if (dbPosts.length > 0 && !selectedPost) {
        setSelectedPost(dbPosts[0]);
        setBoardView('detail');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [likesUpdateTrigger]);

  // Statistics calculation
  const totalPosts = posts.length;
  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const totalLikes = posts.reduce((sum, p) => {
    const val = localStorage.getItem(`likes_count_${p.id}`);
    return sum + (val ? parseInt(val, 10) : 0);
  }, 0);

  // Categories counts calculation
  const getCategoryCount = (cat: 'All' | Category) => {
    if (cat === 'All') return posts.length;
    return posts.filter(p => parseCategoryAndTitle(p.title).category === cat).length;
  };

  // Switch category
  const handleCategorySelect = (cat: 'All' | Category) => {
    setSelectedCategory(cat);
    setActiveTab('board');
    setBoardView('list');
    setMobileMenuOpen(false);
    
    // Auto preview first post in this selected category on desktop
    const filtered = cat === 'All' 
      ? posts 
      : posts.filter(p => parseCategoryAndTitle(p.title).category === cat);
      
    if (filtered.length > 0) {
      setSelectedPost(filtered[0]);
    } else {
      setSelectedPost(null);
    }
  };

  return (
    <div className="h-screen w-screen bg-brand-bg text-brand-text flex overflow-hidden font-sans" id="app-root">
      
      {/* 1. Sidebar Column (Left) - Hidden on Mobile, Collapsible */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-brand-sidebar-bg border-r border-[#1e293b] flex flex-col justify-between p-6 transition-transform duration-300 transform lg:translate-x-0 lg:static lg:flex shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-8">
          {/* Logo Brand Icon Block */}
          <div className="flex items-center justify-between">
            <div 
              onClick={() => handleCategorySelect('All')}
              className="flex items-center gap-3 cursor-pointer"
              id="brand-logo"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
                <Zap className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-white tracking-tight leading-none">조세전문가 게시판</h1>
                <p className="text-[9px] text-brand-sidebar-muted font-bold mt-1.5 uppercase tracking-widest">Connect Board</p>
              </div>
            </div>

            {/* Mobile close sidebar */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="block lg:hidden text-brand-sidebar-muted hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Category list */}
          <div className="space-y-6">
            <div>
              <p className="text-[10px] text-brand-sidebar-muted font-extrabold uppercase tracking-widest pl-2 mb-3">
                Navigation (카테고리)
              </p>
              <nav className="space-y-1">
                {(['All', '공지', '자유', '정보', '질문'] as const).map((cat) => {
                  const isActive = activeTab === 'board' && selectedCategory === cat;
                  const label = cat === 'All' ? 'All Discussions' : cat;
                  const count = getCategoryCount(cat);
                  const isNotice = cat === '공지';

                  return (
                    <button
                      key={cat}
                      onClick={() => handleCategorySelect(cat)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-brand-primary text-white shadow-md' 
                          : 'text-slate-300 hover:bg-brand-sidebar-hover hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${isNotice ? 'bg-red-500' : 'bg-brand-primary'}`} />
                        <span>{label}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isActive 
                          ? 'bg-white/25 text-white' 
                          : isNotice 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Utility links */}
            <div>
              <p className="text-[10px] text-brand-sidebar-muted font-extrabold uppercase tracking-widest pl-2 mb-3">
                App Settings
              </p>
              <nav className="space-y-1">
                <button
                  onClick={() => { setActiveTab('profile'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'profile' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-extrabold' 
                      : 'text-slate-300 hover:bg-brand-sidebar-hover hover:text-white'
                  }`}
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>내 프로필 정보</span>
                </button>
                <button
                  onClick={() => { setActiveTab('guide'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'guide' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-extrabold' 
                      : 'text-slate-300 hover:bg-brand-sidebar-hover hover:text-white'
                  }`}
                >
                  <Database className="w-4 h-4 text-slate-400" />
                  <span>DB 연동 가이드</span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom Bento Box Stats */}
        <div className="space-y-4 pt-6 border-t border-[#1e293b]">
          <div>
            <p className="text-[10px] text-brand-sidebar-muted font-extrabold uppercase tracking-widest pl-2 mb-2.5">
              Database Stat
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#1e293b]/40 border border-[#2e3c54]/40 p-2 rounded-2xl">
                <p className="text-[9px] text-brand-sidebar-muted font-extrabold uppercase">Posts</p>
                <p className="text-xs font-black text-white mt-0.5">{totalPosts}</p>
              </div>
              <div className="bg-[#1e293b]/40 border border-[#2e3c54]/40 p-2 rounded-2xl">
                <p className="text-[9px] text-brand-sidebar-muted font-extrabold uppercase">Views</p>
                <p className="text-xs font-black text-emerald-400 mt-0.5">{totalViews}</p>
              </div>
              <div className="bg-[#1e293b]/40 border border-[#2e3c54]/40 p-2 rounded-2xl">
                <p className="text-[9px] text-brand-sidebar-muted font-extrabold uppercase">Likes</p>
                <p className="text-xs font-black text-pink-400 mt-0.5">{totalLikes}</p>
              </div>
            </div>
          </div>

          {/* User logout section */}
          {currentUser ? (
            <div className="flex items-center justify-between bg-[#1e293b]/30 p-2.5 rounded-2xl border border-brand-sidebar-hover">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-500/30">
                  {userAvatar ? (
                    <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-emerald-500 text-slate-900 font-extrabold text-[10px] flex items-center justify-center">
                      {currentUser.name ? currentUser.name[0] : 'U'}
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-white font-extrabold truncate max-w-[100px]">{currentUser.name}</p>
                  <p className="text-[8px] text-brand-sidebar-muted truncate max-w-[100px]">{currentUser.email}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1 px-1.5 hover:bg-red-500/10 text-rose-400 hover:text-rose-300 rounded-lg text-[9px] font-bold border border-transparent hover:border-red-500/20 cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="bg-[#1e293b]/50 p-3.5 rounded-2xl border border-[#2e3c54]/30 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <LogIn className="w-4 h-4" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-200">회원가입 및 로그인</span>
              </div>
              <p className="text-[10px] text-brand-sidebar-muted leading-normal font-semibold">
                새 글 작성 및 댓글, 추천 등의 원활한 활동을 원하시면 로그인 또는 1초 간편 회원가입을 이용해 보세요.
              </p>
              <button
                onClick={() => { setActiveTab('profile'); setMobileMenuOpen(false); }}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-slate-950 text-xs font-black rounded-xl shadow-xs cursor-pointer text-center"
              >
                회원가입/로그인 ➔
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* App Core Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Mobile Header - Hidden when viewing the BoardList list view on mobile */}
        {!(activeTab === 'board' && boardView === 'list') && (
          <header className="lg:hidden h-14 shrink-0 bg-brand-card border-b border-brand-border px-4 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 text-brand-text hover:bg-brand-secondary rounded-lg"
              >
                <Menu className="w-5.5 h-5.5" />
              </button>
              <span className="text-sm font-extrabold text-brand-text font-serif">조세전문가 게시판</span>
            </div>

            <div className="flex items-center gap-2">
              {currentUser ? (
                <div 
                  onClick={() => setActiveTab('profile')}
                  className="w-7 h-7 rounded-full overflow-hidden border border-brand-border cursor-pointer"
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-brand-secondary text-brand-text font-extrabold text-[10px] flex items-center justify-center">
                      {currentUser.name ? currentUser.name[0] : 'U'}
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="px-2.5 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-[#111] text-[10px] font-black rounded-lg cursor-pointer"
                >
                  로그인
                </button>
              )}
            </div>
          </header>
        )}

        {/* 2 & 3. Split Desktop Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Column 2: list items. 
              Always show on desktop. On mobile, show when activeTab is board AND boardView is list. */}
          <section 
            className={`w-full lg:w-[380px] shrink-0 border-r border-brand-border bg-brand-card flex flex-col h-full overflow-hidden ${
              activeTab === 'board' && boardView === 'list' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <BoardList 
              posts={posts}
              loading={postsLoading}
              selectedCategory={selectedCategory}
              selectedPostId={selectedPost?.id}
              currentUser={currentUser}
              onWriteClick={() => {
                setBoardView('write');
                setActiveTab('board');
              }}
              onPostClick={(post) => {
                setSelectedPost(post);
                setBoardView('detail');
                setActiveTab('board');
              }}
              fetchPosts={fetchPosts}
              onMenuClick={() => setMobileMenuOpen(true)}
              onLoginClick={() => setActiveTab('profile')}
            />
          </section>

          {/* Column 3: Active Detail/Form view panel.
              Always show on desktop. On mobile, show when view is not list, or when activeTab is profile or guide. */}
          <main 
            className={`flex-1 h-full bg-[#f3f5f8] overflow-y-auto p-4 md:p-6 lg:p-8 relative ${
              activeTab === 'board' && boardView === 'list' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Top-right "회원가입 및 로그인 ➔" persistent block for unauthenticated users */}
            {!currentUser && activeTab !== 'profile' && (
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 z-30">
                <button
                  onClick={() => setActiveTab('profile')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-primary hover:bg-brand-primary-hover text-[#111] font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98] hover:shadow-lg"
                  id="top-right-login-btn"
                >
                  <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>회원가입 및 로그인 ➔</span>
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${boardView}-${selectedPost?.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto h-full"
              >
                {activeTab === 'board' && (
                  <>
                    {boardView === 'detail' && selectedPost ? (
                      <PostDetail 
                        post={selectedPost}
                        currentUser={currentUser}
                        onBack={() => {
                          setBoardView('list');
                        }}
                        onEdit={(post) => {
                          setPostToEdit(post);
                          setBoardView('edit');
                        }}
                        onDeleted={() => {
                          setSelectedPost(null);
                          setBoardView('list');
                          fetchPosts();
                        }}
                        onLikeUpdated={() => setLikesUpdateTrigger(prev => prev + 1)}
                      />
                    ) : boardView === 'write' ? (
                      currentUser ? (
                        <PostForm 
                          currentUser={currentUser}
                          onSuccess={() => {
                            setBoardView('list');
                            fetchPosts();
                          }}
                          onCancel={() => setBoardView('list')}
                        />
                      ) : (
                        <div className="bg-brand-card p-8 rounded-3xl text-center max-w-md mx-auto space-y-4 border border-brand-border">
                          <LogIn className="w-10 h-10 text-brand-primary mx-auto" />
                          <p className="text-sm font-semibold text-brand-text">새 포스팅을 게시하려면 로그인이 필요합니다.</p>
                          <button
                            onClick={() => setActiveTab('profile')}
                            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-brand-card font-bold text-xs rounded-xl cursor-pointer"
                          >
                            로그인 및 가입하러 가기
                          </button>
                        </div>
                      )
                    ) : boardView === 'edit' && postToEdit ? (
                      currentUser ? (
                        <PostForm 
                          postToEdit={postToEdit}
                          currentUser={currentUser}
                          onSuccess={() => {
                            setBoardView('list');
                            fetchPosts();
                          }}
                          onCancel={() => setBoardView('list')}
                        />
                      ) : (
                        <div className="bg-brand-card p-8 rounded-3xl text-center max-w-md mx-auto space-y-4 border border-brand-border">
                          <LogIn className="w-10 h-10 text-brand-primary mx-auto animate-bounce" />
                          <p className="text-sm font-semibold text-brand-text">수정 권한을 확인하기 위해 로그인이 필요합니다.</p>
                          <button
                            onClick={() => setActiveTab('profile')}
                            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-brand-card font-bold text-xs rounded-xl cursor-pointer"
                          >
                            로그인 페이지로 가기
                          </button>
                        </div>
                      )
                    ) : (
                      /* Empty list state template on board */
                      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-brand-card rounded-3xl border border-brand-border shadow-xs">
                        <Bookmark className="w-12 h-12 text-brand-muted/70 mb-4 animate-bounce" />
                        <h2 className="text-lg font-bold text-brand-text font-serif">열람할 내용이 없습니다</h2>
                        <p className="text-xs text-brand-muted mt-1.5 max-w-xs mx-auto">
                          좌측 목록에서 포스팅을 하나 클릭하시거나 새 이야기를 게시해 보세요!
                        </p>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'profile' && (
                  currentUser ? (
                    <UserProfile 
                      currentUser={currentUser} 
                      onProfileUpdated={handleProfileUpdated}
                    />
                  ) : (
                    <div className="space-y-6">
                      <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-serif">프로필 및 회원정보</h2>
                        <p className="text-xs text-slate-500 mt-1">포스팅과 프로필 관리를 위해 회원가입 혹은 로그인을 진행해 주세요.</p>
                      </div>
                      <AuthScreen onSuccess={(user) => setCurrentUser(user)} />
                    </div>
                  )
                )}

                {activeTab === 'guide' && (
                  <ConfigGuide />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
