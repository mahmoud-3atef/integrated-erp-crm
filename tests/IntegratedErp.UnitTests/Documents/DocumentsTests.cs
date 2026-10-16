using IntegratedErp.BuildingBlocks.Storage;
using IntegratedErp.Modules.Documents.Domain;
using Microsoft.Extensions.Options;

namespace IntegratedErp.UnitTests.Documents;

public sealed class DocumentsTests
{
    private static readonly byte[] Pdf = "%PDF-1.7\n"u8.ToArray();
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A];
    private static readonly byte[] Exe = "MZ\x90\0"u8.ToArray();

    [Fact]
    public void File_type_needs_both_an_accepted_extension_and_matching_content()
    {
        Assert.Equal("application/pdf", FileRules.ContentTypeOf("cr.PDF", Pdf));
        Assert.Equal("image/png", FileRules.ContentTypeOf("stamp.png", Png));

        Assert.Null(FileRules.ContentTypeOf("cr.pdf", Exe));        // renamed program
        Assert.Null(FileRules.ContentTypeOf("cr.pdf", Png));        // wrong content for the extension
        Assert.Null(FileRules.ContentTypeOf("tool.exe", Exe));      // extension not accepted
        Assert.Null(FileRules.ContentTypeOf("page.html", Pdf));
    }

    [Fact]
    public void File_names_lose_folders_and_unsafe_characters()
    {
        Assert.Equal("passport.pdf", FileRules.CleanFileName(@"C:\Users\x\passport.pdf"));
        Assert.Equal("secret.pdf", FileRules.CleanFileName("../../secret.pdf"));
        Assert.Equal("ab.pdf", FileRules.CleanFileName("a\"<b>.pdf"));
        Assert.Equal("file", FileRules.CleanFileName("   "));
        Assert.Equal(Attachment.FileNameMaxLength, FileRules.CleanFileName(new string('x', 400) + ".pdf").Length);
    }

    [Fact]
    public async Task Storage_keys_cannot_escape_the_root_folder()
    {
        var root = Path.Combine(Path.GetTempPath(), $"erp-files-{Guid.NewGuid():N}");
        try
        {
            var storage = new FileSystemStorage(Options.Create(new StorageOptions { Root = root }));
            await storage.PutAsync("t1/2026/10/abc", new MemoryStream(Pdf), default);
            await using (var read = await storage.OpenReadAsync("t1/2026/10/abc", default))
            {
                Assert.NotNull(read);
            }

            foreach (var bad in new[] { "../outside", "/etc/passwd", "a/../../b", "A/Upper", @"a\b", "" })
            {
                await Assert.ThrowsAsync<ArgumentException>(() => storage.OpenReadAsync(bad, default));
            }

            Assert.Null(await storage.OpenReadAsync("t1/2026/10/missing", default));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void Failed_emails_are_retried_with_back_off_then_given_up()
    {
        var start = new DateTimeOffset(2026, 10, 16, 9, 0, 0, TimeSpan.Zero);
        var email = new OutgoingEmail(null, "a@b.test", "s", "<p>h</p>", "t", start);

        email.MarkFailed("smtp down", start);
        Assert.Equal(start.AddMinutes(1), email.NextAttemptAt);
        email.MarkFailed("smtp down", start);
        Assert.Equal(start.AddMinutes(2), email.NextAttemptAt);

        for (var i = 2; i < OutgoingEmail.MaxAttempts; i++)
        {
            email.MarkFailed("smtp down", start);
        }

        Assert.Equal(EmailStatus.Failed, email.Status);
    }
}
