import SidebarNav from "./beautiful-ui/SidebarNav";

/**
 * FinSight sidebar shell — Beautiful UI SidebarNav + real data.
 */
export function Sidebar({
  user,
  userProfile,
  uploadedDocs,
  chatHistory,
  currentChatId,
  onLogout,
  onNewChat,
  onLoadChat,
  showUsageTooltip,
  setShowUsageTooltip,
}) {
  const activeChat = chatHistory.find((c) => c.id === currentChatId);
  const monogram = (
    user?.firstName?.[0] ||
    user?.emailAddresses?.[0]?.emailAddress?.[0] ||
    "F"
  ).toUpperCase();

  const roleLabel = userProfile?.role
    ? `${String(userProfile.role)} plan`
    : "Account";

  return (
    <SidebarNav
      fill
      workspaceName="FinSight"
      monogram={monogram}
      activeTitle={activeChat?.title ?? null}
      documents={uploadedDocs.map((d) => ({
        id: d.id,
        label: d.fileName,
      }))}
      recents={chatHistory.map((c) => ({
        id: c.id,
        label: c.title,
      }))}
      onNewChat={onNewChat}
      onPick={(id) => onLoadChat(id)}
      onLogout={onLogout}
      footerLabel={roleLabel}
      onFooterClick={() => setShowUsageTooltip?.(!showUsageTooltip)}
    />
  );
}
