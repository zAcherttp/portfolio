import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";

type ListRowFrameProps = useRender.ComponentProps<"div">;

export default function ListRowFrame({
  className,
  render,
  ...props
}: ListRowFrameProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      ...props,
      className: cn(
        "group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover",
        className,
      ),
    },
  });
}
