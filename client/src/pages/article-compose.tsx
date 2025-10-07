import { useRef, useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authenticatedApiRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function ArticleCompose() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const uploadCover = async (file: File) => {
    try {
      setIsUploading(true);
      const form = new FormData();
      form.append("image", file);
      const res = await authenticatedApiRequest(
        "POST",
        "/api/upload/post-image",
        form
      );
      const data = await res.json();
      setCoverUrl(data.url);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublish = async () => {
    // For now, publish as a normal post with body prefixed by title; extend later to dedicated table
    const content = title ? `${title}\n\n${body}` : body;
    try {
      await authenticatedApiRequest("POST", "/api/posts", {
        content,
        imageUrl: coverUrl,
      });
      window.location.href = "/";
    } catch {
      toast({ title: "Failed to publish", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Write article</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => history.back()}>
                Back
              </Button>
              <Button
                onClick={handlePublish}
                disabled={!title.trim() && !body.trim()}
              >
                Publish
              </Button>
            </div>
          </div>

          <div className="glass-effect rounded-2xl p-6 space-y-6">
            <div className="border border-dashed rounded-xl p-6 text-center bg-accent/10">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Cover"
                  className="mx-auto rounded-lg max-h-72 object-contain"
                />
              ) : (
                <>
                  <p className="mb-3">Add a cover image</p>
                  <Button
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? "Uploading..." : "Upload from computer"}
                  </Button>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && uploadCover(e.target.files[0])
                }
              />
            </div>

            <input
              className="w-full text-3xl font-semibold bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              className="min-h-[300px] bg-transparent"
              placeholder="Write here. You can also include @mentions."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
