import Image from "next/image";

/** One brand identity with transparent PNG variants for light and dark surfaces. */
export function AgrarMentorLogo({className,priority=false,onLight=false}:{className?:string;priority?:boolean;onLight?:boolean}){
 return <Image src={onLight?"/images/agrar-mentor-logo-on-light.png":"/images/agrar-mentor-logo.png"} alt="AGRÁR MENTOR" width={1086} height={362} className={className} priority={priority} style={{display:"block",maxWidth:"100%",height:"auto"}}/>;
}
