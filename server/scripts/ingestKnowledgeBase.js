import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { embedText } from "../lib/embeddings.js";
import { DOCUMENTS } from "../lib/knowledgeBase.js";

async function main() {
  console.log(`Ingesting ${DOCUMENTS.length} knowledge base documents...`);

  // Clear existing rows first so re-running this script after an edit
  // doesn't leave stale duplicates alongside updated content.
  const { error: deleteError } = await supabase
    .from("knowledge_documents")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete-all guard
  if (deleteError) {
    console.error("Failed to clear existing knowledge_documents:", deleteError.message);
    process.exit(1);
  }

  for (const doc of DOCUMENTS) {
    try {
      const embedding = await embedText(doc.content, "RETRIEVAL_DOCUMENT");
      const { error } = await supabase.from("knowledge_documents").insert({
        source: doc.source,
        title: doc.title,
        content: doc.content,
        embedding,
      });
      if (error) throw error;
      console.log(`  ✓ [${doc.source}] ${doc.title}`);
    } catch (err) {
      console.error(`  ✗ [${doc.source}] ${doc.title} — ${err.message}`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main();
