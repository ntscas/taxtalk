/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { dbService } from '../supabaseClient';
import { Lock, Mail, User, BookOpen, AlertCircle, Sparkles, LogIn, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthScreenProps {
  onSuccess: (user: any) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200'
];

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await dbService.signIn(email, password);
        if (result.success && result.user) {
          onSuccess(result.user);
        } else {
          setError(result.error || '이메일 또는 비밀번호가 틀렸습니다.');
        }
      } else {
        if (!name.trim()) {
          setError('이름 또는 닉네임을 입력해 주세요.');
          setIsLoading(false);
          return;
        }
        const result = await dbService.signUp(email, password, name, bio, selectedAvatar);
        if (result.success && result.user) {
          onSuccess(result.user);
        } else {
          setError(result.error || '회원가입에 실패했습니다.');
        }
      }
    } catch (err: any) {
      setError('서버와 통신하는 중 예상치 못한 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto" id="auth-screen-container">
      <div className="bg-brand-card rounded-3xl shadow-sm border border-brand-border p-8">
        
        {/* Header Text */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-brand-secondary text-brand-primary rounded-2xl mb-4 border border-brand-border/60">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-brand-text tracking-tight font-serif">
            {isLogin ? '로그인을 환영합니다' : '새로운 계정 만들기'}
          </h1>
          <p className="text-xs text-brand-muted mt-2">
            {isLogin 
              ? '가장 개인적이고 안전한 소통 공간, BoardConnect' 
              : '나만의 프로필과 픽셀 아바타를 세팅하고 게시판 활동을 시작하세요'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 bg-brand-secondary p-1.5 rounded-2xl mb-6 border border-brand-border/40">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${isLogin ? 'bg-brand-primary text-brand-card shadow-sm' : 'text-brand-muted-text hover:text-brand-text'}`}
            id="auth-toggle-login"
          >
            로그인
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer ${!isLogin ? 'bg-brand-primary text-brand-card shadow-sm' : 'text-brand-muted-text hover:text-brand-text'}`}
            id="auth-toggle-signup"
          >
            회원가입
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 p-3.5 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100"
                id="auth-error-banner"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Registration specific fields: Name, Bio, and Avatar selection */}
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Profile Image Presets */}
              <div>
                <label className="block text-xs font-bold text-brand-text mb-2">프리셋 프로필 사진 선택</label>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {PRESET_AVATARS.map((avatar, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`relative shrink-0 rounded-full w-12 h-12 transition-all overflow-hidden cursor-pointer ${selectedAvatar === avatar ? 'ring-2 ring-brand-primary ring-offset-2 scale-105' : 'opacity-70 hover:opacity-100'}`}
                    >
                      <img src={avatar} alt={`Avatar preset ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Name Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-text">이름 또는 닉네임 *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-brand-muted">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full pl-10 pr-4 py-2.5 bg-brand-input border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Bio Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-brand-text">한줄 소개 (선택)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-brand-muted">
                    <BookOpen className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="자신을 한 줄로 멋지게 설명해 보세요"
                    className="w-full pl-10 pr-4 py-2.5 bg-brand-input border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all font-semibold"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-text">이메일 주소</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-brand-muted">
                <Mail className="w-4.5 h-4.5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full pl-10 pr-4 py-2.5 bg-brand-input border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all font-semibold"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-text">비밀번호 {!isLogin && '(6자 이상)'}</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-brand-muted">
                <Lock className="w-4.5 h-4.5" />
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-brand-input border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all font-semibold"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-brand-secondary disabled:text-brand-muted text-brand-card font-semibold text-sm rounded-xl cursor-pointer shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99] group"
            id="auth-submit-btn"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-brand-secondary border-t-brand-primary rounded-full animate-spin"></span>
            ) : (
              <>
                <span>{isLogin ? '로그인하기' : '회원가입 완료'}</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Toggle message */}
        <div className="text-center mt-6 pt-5 border-t border-brand-border/60">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs text-brand-muted hover:text-brand-primary font-bold cursor-pointer"
            id="auth-toggle-link"
          >
            {isLogin 
              ? '아직 회원이 아니신가요? 계정 만들기' 
              : '이미 계정이 있으신가요? 기존 이메일로 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}
