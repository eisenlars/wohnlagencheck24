import type {
  NetworkContentReviewAction,
  NetworkContentReviewStatus,
  NetworkContentStatus,
} from "@/lib/network-partners/types";

export function assertAllowedNetworkContentAction(
  currentStatus: NetworkContentStatus,
  action: NetworkContentReviewAction,
) {
  const allowedActions: Record<NetworkContentStatus, NetworkContentReviewAction[]> = {
    draft: ["submit"],
    in_review: ["approve", "reject"],
    approved: ["publish", "reject"],
    live: ["pause"],
    paused: ["publish"],
    rejected: ["submit", "reset_draft"],
    expired: [],
  };

  if (!allowedActions[currentStatus].includes(action)) {
    throw new Error("INVALID_CONTENT_REVIEW_ACTION");
  }
}

export function resolveNextNetworkContentStatus(
  currentStatus: NetworkContentStatus,
  action: NetworkContentReviewAction,
): NetworkContentStatus {
  assertAllowedNetworkContentAction(currentStatus, action);

  if (action === "submit") return "in_review";
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  if (action === "publish") return "live";
  if (action === "pause") return "paused";
  return "draft";
}

export function resolveReviewStatusForAction(
  action: NetworkContentReviewAction,
): NetworkContentReviewStatus | null {
  if (action === "submit") return "pending";
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  return null;
}
