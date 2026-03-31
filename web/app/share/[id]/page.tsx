import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShare, verifySharePassword } from "@/lib/share-store";
import { SharedConversationView } from "@/components/share/SharedConversationView";
import type { SharedConversation } from "@/lib/types";
import { extractTextContent } from "@/lib/utils";

interface PageProps {
  params: { id: string };
  searchParams: { password?: string; embed?: string; theme?: string; toolUse?: string };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const share = getShare(params.id);
  if (!share) {
    return { title: "Conversation Not Found — Claude Code" };
  }

  const conv = share.conversation;
  const firstUserMsg = conv.messages.find((m) => m.role === "user");
  const preview = firstUserMsg
    ? extractTextContent(firstUserMsg.content).slice(0, 160)
    : "A Claude Code conversation";

  return {
    title: `${conv.title} — Claude Code`,
    description: preview,
    openGraph: {
      title: conv.title,
      description: preview,
      type: "article",
      siteName: "Claude Code",
    },
    twitter: {
      card: "summary",
      title: conv.title,
      description: preview,
    },
  };
}

export default function SharedConversationPage({ params, searchParams }: PageProps) {
  const share = getShare(params.id);

  if (!share) {
    notFound();
  }

  // Password-protected: show gate if no password supplied or wrong password
  if (share.visibility === "password") {
    const suppliedPw = searchParams.password;
    if (!suppliedPw || !verifySharePassword(params.id, suppliedPw)) {
      return <PasswordGate shareId={params.id} />;
    }
  }

  const shared: SharedConversation = {
    id: share.id,
    title: share.conversation.title,
    messages: share.conversation.messages,
    model: share.conversation.model,
    createdAt: share.conversation.createdAt,
    shareCreatedAt: share.createdAt,
  };

  const isEmbed = searchParams.embed === "1";

  if (isEmbed) {
    return (
      <div className="h-screen overflow-auto bg-surface-950">
        <SharedConversationView shared={shared} />
      </div>
    );
  }

  return <SharedConversationView shared={shared} />;
}

// Simple client-side password gate (redirects with ?password= param)
function PasswordGate({ shareId }: { shareId: string }) {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-xl p-6 w-full max-w-sm text-center">
        <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-base font-semibold text-surface-100 mb-1">Password Required</h1>
        <p className="text-sm text-surface-500 mb-4">This conversation is password-protected.</p>
        <form
          action={`/share/${shareId}`}
          method="GET"
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            name="password"
            placeholder="Enter password"
            autoFocus
            className="w-full px-3 py-2 rounded-md bg-surface-800 border border-surface-700 text-sm text-surface-100 placeholder-surface-600 focus:outline-none focus:border-brand-500"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-md text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 transition-colors"
          >
            View Conversation
          </button>
        </form>
      </div>
    </div>
  );
}
