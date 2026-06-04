/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Post, AuthUser, Category, parseCategoryAndTitle, buildTitleWithCategory } from '../types';
import { dbService } from '../supabaseClient';
import { ChevronLeft, Edit3, Save, Compass } from 'lucide-react';
import { motion } from 'motion/react';

interface PostFormProps {
  postToEdit?: Post;
  currentUser: AuthUser;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PostForm({ postToEdit, currentUser, onSuccess, onCancel }: PostFormProps) {
  const parsed = postToEdit ? parseCategoryAndTitle(postToEdit.title) : { category: '자유' as Category, title: '' };
  
  const [category, setCategory] = useState<Category>(parsed.category);
  const [title, setTitle] = useState(postToEdit ? parsed.title : '');
  const [content, setContent] = useState(postToEdit?.content || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('제목과 상세 내용을 모두 작성해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const finalTitle = buildTitleWithCategory(category, title.trim());

    try {
      if (postToEdit) {
        // Edit mode
        const result = await dbService.updatePost(postToEdit.id, finalTitle, content.trim());
        if (result.success) {
          onSuccess();
        } else {
          setError(result.error || '게시글 수정에 실패했습니다.');
        }
      } else {
        // Create mode
        const result = await dbService.createPost(finalTitle, content.trim(), currentUser.id);
        if (result.success) {
          onSuccess();
        } else {
          setError(result.error || '게시글 저장에 실패했습니다.');
        }
      }
    } catch (err: any) {
      setError('서버 연결 중 문제가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-brand-card rounded-3xl border border-brand-border p-8 shadow-xs space-y-6" id="post-form-root">
      
      {/* Detail Navigate Back Header */}
      <div className="flex items-center justify-between border-b border-brand-border/60 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            type="button"
            className="p-1.5 hover:bg-brand-secondary text-brand-muted hover:text-brand-text rounded-xl transition-colors cursor-pointer"
            id="post-form-back-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-brand-primary animate-pulse" />
            <h2 className="text-lg font-bold text-brand-text tracking-tight font-serif">
              {postToEdit ? '게시글 수정하기' : '새로운 이야기 작성'}
            </h2>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {/* Category Picker */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-brand-text">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {(['공지', '자유', '정보', '질문'] as Category[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-4.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  category === cat
                    ? 'bg-brand-primary text-brand-card border-brand-primary shadow-sm scale-[1.02]'
                    : 'bg-brand-secondary text-brand-muted-text border-brand-border hover:bg-brand-hover'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-brand-text">포스팅 제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 명확하고 눈에 띄게 입력해 주세요"
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-brand-input border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all font-semibold"
          />
        </div>

        {/* Content Body Textarea */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-brand-text">본문 내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="동료 사용자들과 나누고 싶은 생각, 고민, 정보 등을 자유롭게 펼쳐놓으세요. 타인을 향한 존중과 따뜻함이 담긴 언어는 커뮤니티를 더 가치있게 합니다."
            rows={10}
            disabled={isSubmitting}
            className="w-full p-4 bg-brand-input border border-brand-border rounded-2xl text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:bg-brand-card transition-all resize-none leading-relaxed"
          />
        </div>

        {/* Buttons Action Group */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border/60">
          <button
            onClick={onCancel}
            type="button"
            className="px-5 py-2.5 bg-brand-secondary hover:bg-brand-hover text-brand-muted-text text-xs font-bold rounded-xl border border-brand-border cursor-pointer transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-brand-secondary disabled:text-brand-muted text-brand-card font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
            id="post-form-submit-btn"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? '저장중...' : postToEdit ? '수정 완료' : '게시하기'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
