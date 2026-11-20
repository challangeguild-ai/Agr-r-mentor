import Image from "next/image";

/** One shared, accessible brand image across the public site and all portal roles. */
export function AgrarMentorLogo({className,priority=false}:{className?:string;priority?:boolean}){
 return <Image src="/images/agrar-mentor-logo.webp" alt="AGRÁR MENTOR" width={2123} height={671} className={className} priority={priority} style={{display:"block",maxWidth:"100%",height:"auto"}}/>;
}
