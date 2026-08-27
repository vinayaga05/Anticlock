import { create } from 'zustand';
import {
  CURRENT_USER,
  seedClipComments,
  seedFlashComments,
  seedFlashPosts,
} from '@/shared/data/flash';
import {
  FeedTab,
  FlashComment,
  FlashPost,
  PostAttachment,
  PostMedia,
  PostVisibility,
  ReactionType,
  SavedContent,
  SavedContentKind,
} from '@/shared/data/flash/types';

type EngagementState = {
  posts: FlashPost[];
  comments: FlashComment[];
  saved: SavedContent[];
  hiddenIds: string[];

  getFeed: (tab: FeedTab) => FlashPost[];
  getPost: (postId: string) => FlashPost | undefined;
  getPostsByAuthor: (authorId: string) => FlashPost[];
  getComments: (postId: string) => FlashComment[];

  setReaction: (postId: string, reaction: ReactionType | null) => void;
  toggleLike: (postId: string) => void;

  createComment: (postId: string, text: string) => void;
  createReply: (postId: string, parentId: string, text: string) => void;
  deleteComment: (commentId: string) => void;
  toggleCommentLike: (commentId: string) => void;

  saveContent: (item: Omit<SavedContent, 'savedAt'>) => void;
  unsaveContent: (id: string) => void;
  toggleSavePost: (postId: string) => void;
  isSaved: (id: string) => boolean;

  shareContent: (postId: string, opts?: { quote?: string; toFlash?: boolean }) => void;

  hidePost: (postId: string) => void;
  deletePost: (postId: string) => void;
  setPostVisibility: (postId: string, visibility: PostVisibility) => void;
  toggleComments: (postId: string) => void;
  pinPost: (postId: string) => void;
  followAuthor: (authorId: string, follow: boolean) => void;

  publishPost: (input: {
    text: string;
    visibility: PostVisibility;
    media?: PostMedia[];
    attachment?: PostAttachment;
  }) => string;
};

function totalReactions(counts: FlashPost['reactionCounts']) {
  return Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
}

function attachmentToSaved(post: FlashPost): SavedContent | null {
  if (!post.attachment) return null;
  const kindMap: Record<string, SavedContentKind> = {
    service: 'service',
    home_service: 'service',
    product: 'product',
    course: 'course',
    event: 'event',
  };
  return {
    id: `saved-att-${post.id}`,
    kind: kindMap[post.attachment.type] ?? 'service',
    title: post.attachment.title,
    subtitle: post.attachment.subtitle,
    imageUrl: post.attachment.imageUrl,
    refId: post.attachment.entityId,
    savedAt: new Date().toISOString(),
  };
}

export const useEngagementStore = create<EngagementState>((set, get) => ({
  posts: seedFlashPosts,
  comments: [...seedFlashComments, ...seedClipComments],
  saved: [],
  hiddenIds: [],

  getFeed: tab => {
    const { posts, hiddenIds } = get();
    return posts.filter(
      p => !p.hidden && !hiddenIds.includes(p.id) && p.feedTabs.includes(tab),
    );
  },

  getPost: postId => get().posts.find(p => p.id === postId),

  getPostsByAuthor: authorId =>
    get().posts.filter(p => p.author.id === authorId && !p.hidden),

  getComments: postId => get().comments.filter(c => c.postId === postId),

  setReaction: (postId, reaction) => {
    set(state => ({
      posts: state.posts.map(p => {
        if (p.id !== postId) return p;
        const counts = { ...p.reactionCounts };
        const prev = p.viewerReaction;
        if (prev) {
          counts[prev] = Math.max(0, (counts[prev] ?? 0) - 1);
        }
        if (reaction) {
          counts[reaction] = (counts[reaction] ?? 0) + 1;
        }
        return { ...p, viewerReaction: reaction, reactionCounts: counts };
      }),
    }));
  },

  toggleLike: postId => {
    const post = get().getPost(postId);
    if (!post) return;
    if (post.viewerReaction === 'like') {
      get().setReaction(postId, null);
    } else {
      get().setReaction(postId, 'like');
    }
  },

  createComment: (postId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment: FlashComment = {
      id: `c-${Date.now()}`,
      postId,
      author: CURRENT_USER,
      text: trimmed,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      isOwn: true,
    };
    set(state => ({
      comments: [...state.comments, comment],
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
      ),
    }));
  },

  createReply: (postId, parentId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment: FlashComment = {
      id: `c-${Date.now()}`,
      postId,
      parentId,
      author: CURRENT_USER,
      text: trimmed,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      isOwn: true,
    };
    set(state => ({
      comments: [...state.comments, comment],
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
      ),
    }));
  },

  deleteComment: commentId => {
    const target = get().comments.find(c => c.id === commentId);
    if (!target?.isOwn) return;
    const toRemove = new Set(
      get()
        .comments.filter(c => c.id === commentId || c.parentId === commentId)
        .map(c => c.id),
    );
    set(state => ({
      comments: state.comments.filter(c => !toRemove.has(c.id)),
      posts: state.posts.map(p =>
        p.id === target.postId
          ? { ...p, commentCount: Math.max(0, p.commentCount - toRemove.size) }
          : p,
      ),
    }));
  },

  toggleCommentLike: commentId => {
    set(state => ({
      comments: state.comments.map(c => {
        if (c.id !== commentId) return c;
        const liked = !c.liked;
        return {
          ...c,
          liked,
          likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)),
        };
      }),
    }));
  },

  saveContent: item => {
    set(state => {
      if (state.saved.some(s => s.id === item.id)) return state;
      return {
        saved: [
          ...state.saved,
          { ...item, savedAt: new Date().toISOString() },
        ],
      };
    });
  },

  unsaveContent: id => {
    set(state => ({ saved: state.saved.filter(s => s.id !== id) }));
  },

  isSaved: id => get().saved.some(s => s.id === id),

  toggleSavePost: postId => {
    const post = get().getPost(postId);
    if (!post) return;
    const savedId = `saved-flash-${postId}`;
    const exists = get().saved.some(s => s.id === savedId);
    if (exists) {
      get().unsaveContent(savedId);
      set(state => ({
        posts: state.posts.map(p =>
          p.id === postId ? { ...p, saved: false } : p,
        ),
      }));
      return;
    }
    get().saveContent({
      id: savedId,
      kind: 'flash',
      title: post.text?.slice(0, 80) || post.attachment?.title || 'Flash post',
      subtitle: post.author.name,
      imageUrl: post.media[0]?.url ?? post.attachment?.imageUrl,
      refId: postId,
    });
    const att = attachmentToSaved(post);
    if (att && !get().saved.some(s => s.id === att.id)) {
      get().saveContent(att);
    }
    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, saved: true } : p,
      ),
    }));
  },

  shareContent: (postId, opts) => {
    const post = get().getPost(postId);
    if (!post) return;
    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, shareCount: p.shareCount + 1 } : p,
      ),
    }));
    if (opts?.toFlash) {
      get().publishPost({
        text: opts.quote?.trim()
          ? `${opts.quote.trim()}\n\nShared from ${post.author.name}`
          : `Shared a post from ${post.author.name}`,
        visibility: 'public',
        media: post.media.slice(0, 1),
        attachment: post.attachment,
      });
    }
  },

  hidePost: postId => {
    set(state => ({
      hiddenIds: [...state.hiddenIds, postId],
      posts: state.posts.map(p =>
        p.id === postId ? { ...p, hidden: true } : p,
      ),
    }));
  },

  deletePost: postId => {
    const post = get().getPost(postId);
    if (!post?.isOwn) return;
    set(state => ({
      posts: state.posts.filter(p => p.id !== postId),
      comments: state.comments.filter(c => c.postId !== postId),
    }));
  },

  setPostVisibility: (postId, visibility) => {
    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId && p.isOwn ? { ...p, visibility } : p,
      ),
    }));
  },

  toggleComments: postId => {
    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId && p.isOwn
          ? { ...p, commentsEnabled: p.commentsEnabled === false }
          : p,
      ),
    }));
  },

  pinPost: postId => {
    set(state => ({
      posts: state.posts.map(p =>
        p.id === postId && p.isOwn ? { ...p, pinned: !p.pinned } : p,
      ),
    }));
  },

  followAuthor: (authorId, follow) => {
    set(state => ({
      posts: state.posts.map(p =>
        p.author.id === authorId
          ? { ...p, author: { ...p.author, followed: follow } }
          : p,
      ),
    }));
  },

  publishPost: input => {
    const id = `post-${Date.now()}`;
    const post: FlashPost = {
      id,
      author: CURRENT_USER,
      createdAt: new Date().toISOString(),
      timeLabel: 'Just now',
      visibility: input.visibility,
      text: input.text,
      media: input.media ?? [],
      attachment: input.attachment,
      feedTabs: ['forYou', 'following'],
      reactionCounts: {},
      commentCount: 0,
      shareCount: 0,
      isOwn: true,
      commentsEnabled: true,
    };
    set(state => ({ posts: [post, ...state.posts] }));
    return id;
  },
}));

/** Convenience helpers mirroring EngagementRepository API from the plan. */
export const EngagementRepository = {
  addReaction: (postId: string, reaction: ReactionType) =>
    useEngagementStore.getState().setReaction(postId, reaction),
  removeReaction: (postId: string) =>
    useEngagementStore.getState().setReaction(postId, null),
  createComment: (postId: string, text: string) =>
    useEngagementStore.getState().createComment(postId, text),
  createReply: (postId: string, parentId: string, text: string) =>
    useEngagementStore.getState().createReply(postId, parentId, text),
  deleteComment: (commentId: string) =>
    useEngagementStore.getState().deleteComment(commentId),
  saveContent: (item: Omit<SavedContent, 'savedAt'>) =>
    useEngagementStore.getState().saveContent(item),
  unsaveContent: (id: string) =>
    useEngagementStore.getState().unsaveContent(id),
  shareContent: (postId: string, opts?: { quote?: string; toFlash?: boolean }) =>
    useEngagementStore.getState().shareContent(postId, opts),
  totalReactions,
};
