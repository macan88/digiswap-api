import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NfasAuctionService } from './nfas/nfas-auction.service';
import { NfasTrackingService } from './nfas/nfas-tracking.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const trackingService = app.get(NfasTrackingService);
  const auctionService = app.get(NfasAuctionService);
  trackingService.listenToEvents();
  auctionService.listenToEvents();
  const config = new DocumentBuilder()
    .setTitle('Api Digiswap')
    .setDescription('Digidex services')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  app.useGlobalPipes(new ValidationPipe());
  Sentry.init({
    dsn: 'https://37276c9c01c54658988cf3e379ea3712@o1383816.ingest.sentry.io/4504027004796928',
    environment: 'develop',
  });
  await app.listen(process.env.PORT || 8080);
}
bootstrap();
